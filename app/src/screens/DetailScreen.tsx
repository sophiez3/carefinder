import { placeLabel } from '../placeLabel'
import { EvidenceBadge, factorColor, Icon, ScoreBar } from '../components/ui'
import type { ScoredFacility, Service, Urgency } from '../types'
import { directionsUrl } from './ResultsScreen'

const EVIDENCE_CHECKS: Array<[string, string, number]> = [
  ['procedures', 'Named in procedures', 30],
  ['equipment', 'Named in equipment', 25],
  ['description', 'Named in description', 15],
  ['capability/specialties', 'Named in specialties / capabilities', 10],
]

function Fact({ icon, label, value, missing = false, href }: { icon: string; label: string; value: string; missing?: boolean; href?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500"><Icon name={icon} size={18} /></span>
      <div className="min-w-0">
        <div className="text-xs font-bold text-slate-400">{label}</div>
        {href ? <a href={href} target="_blank" rel="noreferrer" className="mt-0.5 block text-sm font-bold text-teal underline underline-offset-2">{value}</a>
          : <div className={`mt-0.5 text-sm font-bold ${missing ? 'italic text-slate-400' : 'text-ink'}`}>{value}</div>}
      </div>
    </div>
  )
}

export default function DetailScreen({ f, service, urgency, goBack }: { f: ScoredFacility; service?: Service; urgency: Urgency; goBack: () => void }) {
  const staffData = f.doctors_n != null || f.beds_n != null
  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-50 pb-20">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1080px] px-5 py-7 lg:px-8">
          <button onClick={goBack} className="mb-5 flex min-h-10 items-center gap-1 text-sm font-extrabold text-teal">← Back to results</button>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-teal px-2.5 py-1 text-[11px] font-extrabold text-white">#{f.rank} for {service?.label}</span><EvidenceBadge level={f.evidence_tier} /></div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{f.name}</h1>
              <p className="mt-2 flex items-start gap-2 text-slate-600"><Icon name="pin" size={18} className="mt-0.5 shrink-0 text-teal" /> {f.address || placeLabel(f.city, f.district, f.state)}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm font-bold text-slate-700">
                <span>{f.km} km away</span><span className="text-slate-300">•</span><span>~{f.travelMin} min drive <span className="font-normal text-slate-400">(estimate)</span></span>
                <span className="text-slate-300">•</span><span className={f.is_24x7 ? 'text-emerald-800' : 'text-slate-500'}>{f.is_24x7 ? 'Listed as 24/7' : 'Hours not listed'}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {f.phone && <a href={`tel:${f.phone}`} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-teal px-5 font-extrabold text-teal"><Icon name="phone" size={18} /> Call</a>}
              <a href={directionsUrl(f)} target="_blank" rel="noreferrer" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-teal px-5 font-extrabold text-white"><Icon name="directions" size={18} /> Directions</a>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1080px] gap-5 px-5 py-6 lg:grid-cols-[1fr_340px] lg:px-8">
        <div className="space-y-5">
          {/* Overall score + breakdown */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm font-bold text-slate-500">Match score ({urgency.toLowerCase()} weights)</div>
                <div className="mt-1 text-4xl font-extrabold text-teal-dark">{Math.round(f.overall)}<span className="text-xl text-slate-400">/100</span></div>
              </div>
              <div className="text-right text-xs font-semibold text-slate-500">{f.pointsEarned} of {f.pointsPossible} possible points<br />(factors with no data are left out)</div>
            </div>
            <div className="mt-4"><ScoreBar factors={f.factors} possible={f.pointsPossible} /></div>
            <p className="mt-3 text-sm font-semibold text-teal-dark">Why #{f.rank}: {f.headline}</p>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-400"><th className="py-2">Factor</th><th className="py-2 pl-3 text-right">Weight</th><th className="py-2 pl-3 text-right">Score</th><th className="py-2 pl-3 text-right">Points</th><th className="py-2 pl-4">Why</th></tr></thead>
                <tbody>
                  {f.factors.map((x) => (
                    <tr key={x.key} className={`border-b border-slate-100 ${x.score == null ? 'text-slate-400' : ''}`}>
                      <td className="py-2.5 font-semibold"><span className={`mr-2 inline-block size-2.5 rounded-full ${factorColor(x.key)}`} />{x.label}</td>
                      <td className="py-2.5 pl-3 text-right">{x.weight}</td>
                      <td className="py-2.5 pl-3 text-right">{x.score == null ? '—' : x.score.toFixed(2)}</td>
                      <td className="py-2.5 pl-3 text-right font-extrabold">{x.score == null ? 'excluded' : x.points}</td>
                      <td className="py-2.5 pl-4 text-slate-500">{x.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Evidence checklist */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-end justify-between">
              <div><h2 className="text-xl font-extrabold text-ink">What the evidence says</h2><p className="mt-1 text-sm text-slate-500">Where “{service?.label}” appears in this facility’s listing.</p></div>
              <div className="text-right"><div className="text-xs font-bold text-slate-400">Evidence points</div><div className="text-2xl font-extrabold text-emerald-800">{f.evidence_score}<span className="text-sm text-slate-400">/90</span></div></div>
            </div>
            <div className="mt-5 divide-y divide-slate-100">
              {[...EVIDENCE_CHECKS.map(([k, label, pts]) => [label, pts, f.matched_fields.includes(k)] as const), ['Reports doctors or beds', 10, staffData] as const].map(([label, pts, ok]) => (
                <div key={label} className="flex min-h-13 items-center gap-3 py-2.5">
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full ${ok ? 'bg-emerald-100 text-emerald-800' : 'border-2 border-slate-200 text-slate-300'}`}>{ok && <Icon name="check" size={16} strokeWidth={3} />}</span>
                  <span className={`flex-1 font-semibold ${ok ? 'text-ink' : 'text-slate-400'}`}>{label}</span>
                  <span className={`rounded-lg px-2 py-1 text-xs font-extrabold ${ok ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-400'}`}>+{pts} pts</span>
                </div>
              ))}
            </div>
          </section>

          {/* Quotes */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-xl font-extrabold text-ink">Quotes from the listing</h2>
            {f.evidence_quotes.length === 0 && <p className="mt-3 text-sm italic text-slate-500">No quotable text found.</p>}
            <div className="mt-4 space-y-3">
              {f.evidence_quotes.map((q, i) => (
                <blockquote key={i} className="rounded-xl border-l-4 border-teal-300 bg-slate-50 p-4 text-[15px] leading-6 text-slate-700">
                  “{q.trim()}”
                  {f.source_urls[i] ?? f.source_urls[0] ? (
                    <a href={f.source_urls[i] ?? f.source_urls[0]} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 text-xs font-extrabold text-teal">View source <Icon name="external" size={13} /></a>
                  ) : null}
                </blockquote>
              ))}
            </div>
            {f.source_urls.length > 1 && <p className="mt-3 text-xs text-slate-500">{f.source_urls.length} source pages were combined into this record.</p>}
          </section>

          {f.warnings.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-amber-950"><Icon name="warning" className="text-amber-700" /> Things to double-check</h2>
              <ul className="mt-3 space-y-2 leading-6 text-amber-950">{f.warnings.map((w) => <li key={w} className="flex gap-2"><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-amber-600" />{w}</li>)}</ul>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-extrabold text-ink">Facility facts</h2>
            <div className="mt-4 space-y-4">
              <Fact icon="bed" label="Beds" value={f.beds_n != null ? `${f.beds_n} beds` : 'Not reported'} missing={f.beds_n == null} />
              <Fact icon="users" label="Doctors" value={f.doctors_n != null ? `${f.doctors_n} reported` : 'Not reported'} missing={f.doctors_n == null} />
              <Fact icon="calendar" label="Year established" value={f.year_est ?? 'Not reported'} missing={!f.year_est} />
              <Fact icon="wallet" label="Ownership" value={f.ownership === 'UNKNOWN' ? 'Unknown' : `${f.ownership.toLowerCase()} (source: ${f.ownership_source})`} missing={f.ownership === 'UNKNOWN'} />
              <Fact icon="shield" label="Outside verification" value={f.verification ? `${f.verification} match: ${f.verification_sources.join(', ')}` : 'Not found in outside sources'} missing={!f.verification} />
              {f.osm_url && <Fact icon="external" label="OpenStreetMap record" value="View on OpenStreetMap" href={f.osm_url} />}
              <Fact icon="clock" label="Wait time" value="Not reported" missing />
              <Fact icon="phone" label="Contact" value={f.phone ?? 'Not in listing'} missing={!f.phone} />
            </div>
          </section>
          <section className="rounded-2xl bg-teal p-5 text-white">
            <Icon name="phone" size={24} />
            <h2 className="mt-3 text-lg font-extrabold">Always call ahead</h2>
            <p className="mt-2 text-sm leading-6 text-teal-50">Confirm the service is available today, the cost, and whether your insurance is accepted before starting your journey.</p>
            {f.phone && <a href={`tel:${f.phone}`} className="mt-4 grid min-h-12 w-full place-items-center rounded-xl bg-white font-extrabold text-teal">Call facility</a>}
          </section>
        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-teal-200 bg-teal-pale px-4 py-3 text-center text-sm font-bold text-teal-dark lg:hidden">
        <Icon name="info" size={16} className="mr-1 inline" /> Always call ahead to confirm availability today.
      </div>
    </main>
  )
}
