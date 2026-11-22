export type Screen = 'search' | 'results' | 'detail' | 'method'
export type Tier = 'STRONG' | 'MODERATE' | 'WEAK'
export type Urgency = 'EMERGENCY' | 'PLANNED'
export type Ownership = 'PUBLIC' | 'PRIVATE' | 'NONPROFIT' | 'UNKNOWN'
export type Budget = 'any' | 'prefer_public' | 'free_only'
export type Insurance = 'none' | 'govt_scheme' | 'private'
export type MatchConfidence = 'HIGH' | 'MEDIUM' | null

/** One service the app can search for (mirrors workspace.datathon.services). */
export interface Service {
  service: string
  label: string
  icon: string
  defaultUrgency: Urgency
}

/** Condition -> service lookup (mirrors workspace.datathon.condition_to_service). */
export interface ConditionMapping {
  condition: string
  service: string
}

/** What the user asked for. */
export interface SearchInput {
  service: string
  place: string // PIN code, city or district
  lat?: number // set by "Use my location"
  lon?: number
  urgency: 'auto' | Urgency
  arrival: 'now' | string // 'now' or 'HH:MM'
  budget: Budget
  insurance: Insurance
  maxKm: number
}

/** Raw facts about one candidate facility, as returned by /api/search. No scores yet. */
export interface Candidate {
  facility_id: string
  name: string
  city: string | null
  district: string | null
  state: string | null
  address: string | null
  phone: string | null
  lat: number
  lon: number
  km: number
  evidence_score: number // 0-90 from the trust table
  evidence_tier: Tier
  matched_fields: string[]
  evidence_quotes: string[]
  source_urls: string[]
  location_confidence: string
  flags: string[]
  is_24x7: boolean
  ownership: Ownership
  ownership_source: string // 'OpenStreetMap' | 'listing keywords' | 'unknown'
  mentions_govt_scheme: boolean
  mentions_private_insurance: boolean
  has_specialist: boolean
  has_equipment: boolean
  doctors_n: number | null
  beds_n: number | null
  year_est: string | null
  verification: MatchConfidence // best outside-source match (OSM, PM-JAY, NABH...)
  verification_sources: string[]
  osm_url: string | null
  wait_minutes: number | null // always null today: no wait-time source
}

export interface FactorResult {
  key: FactorKey
  label: string
  weight: number // out of 100 for the active urgency
  score: number | null // 0-1, null = no data (excluded and rescaled)
  points: number // weight x score
  note: string // plain-language reason
}

export interface ScoredFacility extends Candidate {
  rank: number
  group: 'recommended' | 'other'
  overall: number // 0-100 after rescaling
  pointsEarned: number
  pointsPossible: number
  travelMin: number
  open: 'listed_24x7' | 'unknown'
  factors: FactorResult[]
  warnings: string[]
  headline: string
}

export interface Origin {
  label: string
  lat: number
  lon: number
  district?: string | null
  state?: string | null
}

export interface SearchResponse {
  mode: 'live' | 'sample'
  origin: Origin
  candidates: Candidate[]
}

export type FactorKey =
  | 'travel'
  | 'evidence'
  | 'hours'
  | 'wait'
  | 'specialist'
  | 'equipment'
  | 'verification'
  | 'cost'
  | 'insurance'
  | 'location'
  | 'capacity'

export interface Profile {
  homePlace: string
  budget: Budget
  insurance: Insurance
  maxKm: number
}
