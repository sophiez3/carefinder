/**
 * CareFinder ranking engine — the single source of truth for weights and rubric.
 *
 * Every factor scores 0–1. points = weight × score. Weights add up to 100 per urgency mode.
 * A factor with no data (score = null) is left out and the rest are rescaled:
 *   overall = points earned ÷ points possible from known factors × 100
 * The notebook's Step 9 SQL uses the same numbers.
 */
import type { Candidate, FactorKey, FactorResult, ScoredFacility, SearchInput, Urgency } from './types'

export const FACTORS: Array<{
  key: FactorKey
  label: string
  emergency: number
  planned: number
  why: string
  rubric: string
}> = [
  { key: 'travel', label: 'Travel time', emergency: 25, planned: 10,
    why: 'In an emergency, minutes cost lives. For planned care, patients can travel farther for better care.',
    rubric: 'Score halves every 45 min of estimated driving: 0 min = 1.0, 45 min = 0.5, 90 min = 0.25.' },
  { key: 'evidence', label: 'Evidence the service exists', emergency: 20, planned: 20,
    why: 'A close hospital that does not actually offer the service is useless.',
    rubric: 'Evidence points ÷ 90: procedures +30, equipment +25, description +15, specialties +10, staff/bed data +10.' },
  { key: 'hours', label: 'Open when you arrive', emergency: 15, planned: 3,
    why: 'A closed hospital fails an emergency. Planned visits can be scheduled around opening hours.',
    rubric: 'Listed 24/7 = 1.0. Hours unknown, daytime arrival = 0.6. Hours unknown, night arrival = 0.2.' },
  { key: 'wait', label: 'Wait time', emergency: 10, planned: 7,
    why: 'Matters, but no source reports it yet.',
    rubric: 'Score halves every 60 min of wait. No data today, so it is left out and the other weights are rescaled.' },
  { key: 'specialist', label: 'Specialist (doctor type)', emergency: 7, planned: 10,
    why: 'Shows the right people are there, e.g. a nephrologist for dialysis.',
    rubric: 'The doctor type this service needs is named in the listing = 1.0, otherwise 0.' },
  { key: 'equipment', label: 'Equipment', emergency: 8, planned: 10,
    why: 'Shows the right machines are there, e.g. a cath lab or CT scanner.',
    rubric: 'The equipment this service needs is named in the listing = 1.0, otherwise 0.' },
  { key: 'verification', label: 'Outside verification', emergency: 5, planned: 10,
    why: 'Independent confirmation from another database. More time to verify for planned care.',
    rubric: 'HIGH-confidence match in an outside source (OpenStreetMap, PM-JAY, NABH) = 1.0, MEDIUM = 0.6, no match = 0.3. Not being listed is not proof of a problem.' },
  { key: 'cost', label: 'Cost (public vs private fit)', emergency: 2, planned: 12,
    why: 'Nobody should skip emergency care over price. For planned care, cost decides whether the patient goes at all.',
    rubric: 'Any budget, or a public/non-profit facility = 1.0. Ownership unknown = 0.5. Private when you prefer public = 0.2.' },
  { key: 'insurance', label: 'Insurance fit', emergency: 3, planned: 10,
    why: 'Ayushman Bharat or private cover can make care affordable.',
    rubric: 'No insurance chosen = 1.0. Government scheme: public facility = 1.0, mentions schemes = 0.7, unknown = 0.3. Private insurance: mentions cashless/insurance = 1.0, unknown = 0.3.' },
  { key: 'location', label: 'Location confidence', emergency: 3, planned: 3,
    why: 'Sending someone to the wrong address is costly; problems also show as warnings.',
    rubric: 'Coordinates agree with the PIN code = 1.0. Only the PIN centre is known = 0.6. Conflicting locations = 0.2.' },
  { key: 'capacity', label: 'Capacity (doctors / beds)', emergency: 2, planned: 5,
    why: 'A rough size signal. It does not measure quality, so it gets a low weight.',
    rubric: 'Log-scaled: 50+ doctors or 200+ beds = 1.0. Not reported = 0.3.' },
]

export const ROAD_FACTOR = 1.3 // straight-line km × 1.3 ≈ road km
export const AVG_SPEED_KMH = 35

export function weightsFor(urgency: Urgency): Record<FactorKey, number> {
  return Object.fromEntries(FACTORS.map((f) => [f.key, urgency === 'EMERGENCY' ? f.emergency : f.planned])) as Record<FactorKey, number>
}

export function isNight(arrival: string, now = new Date()): boolean {
  let h: number
  if (arrival === 'now') h = now.getHours()
  else h = Number(arrival.split(':')[0])
  return h >= 20 || h < 7
}

const round1 = (n: number) => Math.round(n * 10) / 10

function score(c: Candidate, input: SearchInput, night: boolean, travelMin: number): Record<FactorKey, { s: number | null; note: string }> {
  const ownershipKnown = c.ownership !== 'UNKNOWN'
  const publicLike = c.ownership === 'PUBLIC' || c.ownership === 'NONPROFIT'

  let cost: number
  if (input.budget === 'any') cost = 1
  else if (publicLike) cost = 1
  else if (!ownershipKnown) cost = 0.5
  else cost = 0.2

  let ins: number
  if (input.insurance === 'none') ins = 1
  else if (input.insurance === 'govt_scheme') ins = c.ownership === 'PUBLIC' ? 1 : c.mentions_govt_scheme ? 0.7 : 0.3
  else ins = c.mentions_private_insurance ? 1 : 0.3

  const loc = c.location_confidence.startsWith('HIGH') ? 1 : c.location_confidence.startsWith('APPROX') ? 0.6 : c.location_confidence.startsWith('LOW') ? 0.2 : 0.4

  let cap = 0.3
  if (c.doctors_n != null || c.beds_n != null) {
    const d = c.doctors_n != null ? Math.min(1, Math.log(1 + c.doctors_n) / Math.log(51)) : 0
    const b = c.beds_n != null ? Math.min(1, Math.log(1 + c.beds_n) / Math.log(201)) : 0
    cap = Math.max(d, b)
  }

  const ver = c.verification === 'HIGH' ? 1 : c.verification === 'MEDIUM' ? 0.6 : 0.3
  const hours = c.is_24x7 ? 1 : night ? 0.2 : 0.6

  return {
    travel: { s: Math.pow(0.5, travelMin / 45), note: `~${Math.round(travelMin)} min estimated drive (${round1(c.km)} km straight line)` },
    evidence: { s: Math.min(1, c.evidence_score / 90), note: c.matched_fields.length ? `Named in ${c.matched_fields.join(', ')}` : 'Barely mentioned' },
    hours: { s: hours, note: c.is_24x7 ? 'Listing says 24/7' : night ? 'Hours not listed — arriving at night' : 'Hours not listed' },
    wait: { s: c.wait_minutes == null ? null : Math.pow(0.5, c.wait_minutes / 60), note: c.wait_minutes == null ? 'Not reported by any source' : `~${c.wait_minutes} min` },
    specialist: { s: c.has_specialist ? 1 : 0, note: c.has_specialist ? 'Right doctor type listed' : 'Doctor type not listed' },
    equipment: { s: c.has_equipment ? 1 : 0, note: c.has_equipment ? 'Needed equipment listed' : 'Equipment not listed' },
    verification: { s: ver, note: c.verification ? `${c.verification === 'HIGH' ? 'Confirmed' : 'Likely match'} in ${c.verification_sources.join(', ')}` : 'Not found in outside sources' },
    cost: { s: cost, note: input.budget === 'any' ? 'Any budget' : `${c.ownership.toLowerCase()} facility (${c.ownership_source})` },
    insurance: { s: ins, note: input.insurance === 'none' ? 'No insurance chosen' : ins === 1 ? 'Likely accepted' : ins >= 0.7 ? 'Mentions schemes, not confirmed' : 'Unknown — ask when calling' },
    location: { s: loc, note: c.location_confidence },
    capacity: { s: cap, note: c.doctors_n != null || c.beds_n != null ? [c.doctors_n != null && `${c.doctors_n} doctors`, c.beds_n != null && `${c.beds_n} beds`].filter(Boolean).join(', ') : 'Not reported' },
  }
}

const WARNING_TEXT: Record<string, string> = {
  LOCATION_MISMATCH: 'Map location conflicts with its PIN code — confirm the address before travelling.',
  USING_PIN_CENTROID: 'Exact location unknown — distance is measured to the PIN code centre.',
  PIN_SPANS_DISTRICTS: 'This PIN code covers more than one district.',
  THIN_EVIDENCE: 'Only one weak mention of this service — call to confirm.',
}

export function resolveUrgency(input: SearchInput, defaultUrgency: Urgency): Urgency {
  return input.urgency === 'auto' ? defaultUrgency : input.urgency
}

export function rank(candidates: Candidate[], input: SearchInput, urgency: Urgency): ScoredFacility[] {
  const w = weightsFor(urgency)
  const night = isNight(input.arrival)

  const kept = candidates.filter((c) => c.km <= input.maxKm && !(input.budget === 'free_only' && c.ownership === 'PRIVATE'))

  const scored = kept.map((c) => {
    const exactMin = ((c.km * ROAD_FACTOR) / AVG_SPEED_KMH) * 60
    const travelMin = Math.round(exactMin)
    const s = score(c, input, night, exactMin)
    const factors: FactorResult[] = FACTORS.map((f) => {
      const sc = s[f.key].s
      return { key: f.key, label: f.label, weight: w[f.key], score: sc, points: sc == null ? 0 : round1(w[f.key] * sc), note: s[f.key].note }
    })
    const possible = factors.filter((f) => f.score != null).reduce((a, f) => a + f.weight, 0)
    const earned = factors.reduce((a, f) => a + (f.score == null ? 0 : f.weight * (f.score ?? 0)), 0)

    const warnings = c.flags.map((f) => WARNING_TEXT[f]).filter(Boolean) as string[]
    if (!c.is_24x7 && night) warnings.unshift('Not listed as open 24/7 — call before going at night.')
    if (urgency === 'EMERGENCY' && !c.is_24x7) warnings.push('Opening hours unknown — in an emergency, call ahead or pick a 24/7 option.')
    if (c.ownership === 'UNKNOWN' && input.budget !== 'any') warnings.push('Cost unknown — ask whether it is government or private when you call.')
    if (!c.has_equipment) warnings.push('Needed equipment is not listed.')
    if (!c.has_specialist) warnings.push('The right specialist is not listed.')

    return {
      ...c,
      rank: 0,
      group: c.evidence_tier === 'WEAK' ? 'other' : 'recommended',
      overall: possible ? round1((earned / possible) * 100) : 0,
      pointsEarned: round1(earned),
      pointsPossible: possible,
      travelMin,
      open: c.is_24x7 ? 'listed_24x7' : 'unknown',
      factors,
      warnings: [...new Set(warnings)],
      headline: '',
    } satisfies ScoredFacility
  })

  // Hard rule B: WEAK evidence always below the rest.
  scored.sort((a, b) => (a.group === b.group ? b.overall - a.overall : a.group === 'recommended' ? -1 : 1))
  scored.forEach((f, i) => {
    f.rank = i + 1
    f.headline = headline(f)
  })
  return scored
}

/** "Ranked #1 mainly because: …" — the top 3 contributing factors in plain words. */
function headline(f: ScoredFacility): string {
  const phrases: Partial<Record<FactorKey, string>> = {
    travel: `${f.travelMin} min away`,
    evidence: `${f.evidence_tier.toLowerCase()} evidence for this service`,
    hours: 'listed as 24/7',
    specialist: 'right specialist listed',
    equipment: 'needed equipment listed',
    verification: 'confirmed by an outside source',
    cost: f.ownership === 'PUBLIC' ? 'government facility' : 'fits your budget',
    insurance: 'likely takes your insurance',
    capacity: 'larger facility',
  }
  const top = [...f.factors]
    .filter((x) => x.score != null && x.score >= 0.6 && phrases[x.key])
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((x) => phrases[x.key])
  return top.length ? top.join(' · ') : 'Closest available match — evidence is limited'
}

export function sortBy(list: ScoredFacility[], mode: 'best' | 'nearest' | 'evidence'): ScoredFacility[] {
  if (mode === 'best') return list
  const copy = [...list]
  if (mode === 'nearest') copy.sort((a, b) => a.km - b.km)
  else copy.sort((a, b) => b.evidence_score - a.evidence_score)
  return copy
}
