import { lazy, Suspense, useMemo, useState } from 'react'
import { placeLabel } from '../placeLabel'
import { EvidenceBadge, Icon, ScoreBar, WarningChip } from '../components/ui'
import { sortBy } from '../scoring'
import type { Origin, ScoredFacility, Service, Urgency } from '../types'

const MapView = lazy(() => import('../components/MapView'))

export function directionsUrl(f: { lat: number; lon: number }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lon}`
}

const OWNER_LABEL = { PUBLIC: 'Government', PRIVATE: 'Private', NONPROFIT: 'Non-profit', UNKNOWN: 'Ownership unknown' }

function ResultCard({ f, service, onDetail, best }: { f: ScoredFacility; service?: Service; onDetail: () => void; best: boolean }) {
  return (
    <article className={`rounded-2xl border bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg ${best ? 'border-teal-300 ring-1 ring-teal-100' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-sm font-extrabold ${best ? 'bg-teal text-white' : 'bg-slate-100 text-slate-700'}`}>{f.rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-lg font-extrabold leading-6 text-ink">{f.name}</h3>
              <p className="mt-0.5 text-sm text-slate-500">{placeLabel(f.city, f.district, f.state)}</p>
            </div>
            <EvidenceBadge level={f.evidence_tier} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="flex-1">
          <div className="mb-1.5 flex items-baseline justify-between text-xs font-bold text-slate-500"><span>Match score</span><span className="text-xl font-extrabold text-ink">{Math.round(f.overall)}<span className="text-xs text-slate-400">/100</span></span></div>
          <ScoreBar factors={f.factors} possible={f.pointsPossible} />
        </div>
      </div>
      <p className="mt-2 text-sm font-semibold text-teal-dark">{best ? 'Top pick: ' : ''}{f.headline}</p>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm font-semibold text-slate-700">
        <span className="inline-flex items-center gap-1.5"><Icon name="pin" size={16} className="text-teal" /> {f.km} km</span>
        <span className="inline-flex items-center gap-1.5" title="Estimated from distance, not live traffic"><Icon name="clock" size={16} className="text-slate-400" /> ~{f.travelMin} min drive <span className="text-xs font-normal text-slate-400">(est.)</span></span>
        <span className={`inline-flex items-center gap-1.5 ${f.is_24x7 ? 'text-emerald-800' : 'text-slate-500'}`}><Icon name={f.is_24x7 ? 'check' : 'moon'} size={16} /> {f.is_24x7 ? 'Listed as 24/7' : 'Hours not listed'}</span>
        <span className="inline-flex items-center gap-1.5 text-slate-500"><Icon name="wallet" size={16} /> {OWNER_LABEL[f.ownership]}</span>
        <span className="col-span-2 text-slate-400">Wait time: <span className="italic">{f.wait_minutes == null ? 'not reported' : `~${f.wait_minutes} min`}</span></span>
      </div>

      {f.evidence_quotes[0] && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3.5">
          <div className="flex items-center gap-2 text-sm font-bold text-ink"><Icon name={service?.icon ?? 'info'} size={17} className="text-teal" /> {service?.label} <span className="font-medium text-slate-500">— named in {f.matched_fields.join(', ') || 'listing'}</span></div>
          <blockquote className="mt-2 border-l-2 border-teal-300 pl-3 text-sm italic leading-5 text-slate-600">“{f.evidence_quotes[0]}” {f.source_urls[0] && <a href={f.source_urls[0]} target="_blank" rel="noreferrer" className="ml-1 not-italic font-bold text-teal underline decoration-teal-200 underline-offset-2">Source</a>}</blockquote>
        </div>
      )}

      {f.warnings.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {f.warnings.slice(0, 2).map((w) => <WarningChip key={w}>{w}</WarningChip>)}
          {f.warnings.length > 2 && <span className="self-center text-xs font-bold text-slate-400">+{f.warnings.length - 2} more</span>}
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        {f.phone ? (
          <a href={`tel:${f.phone}`} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"><Icon name="phone" size={17} /> Call</a>
        ) : (
          <span title="No phone number in the listing" className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-100 text-sm font-bold text-slate-300"><Icon name="phone" size={17} /> No phone</span>
        )}
        <a href={directionsUrl(f)} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"><Icon name="directions" size={17} /> Directions</a>
        <button onClick={onDetail} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-teal-pale text-sm font-extrabold text-teal hover:bg-teal-100">Why this?</button>
      </div>
    </article>
  )
}

export default function ResultsScreen({ origin, results, service, urgency, maxKm, loading, onDetail, onBack }: {
  origin: Origin | null
  results: ScoredFacility[]
  service?: Service
  urgency: Urgency
  maxKm: number
  loading: boolean
  onDetail: (f: ScoredFacility) => void
  onBack: () => void
}) {
  const [view, setView] = useState<'list' | 'map'>('list')
  const [sort, setSort] = useState<'best' | 'nearest' | 'evidence'>('best')
  const sorted = useMemo(() => sortBy(results, sort), [results, sort])
  const recommended = sorted.filter((f) => f.group === 'recommended').slice(0, 10)
  const others = sorted.filter((f) => f.group === 'other').slice(0, 5)
  const closest = results.length ? [...results].sort((a, b) => a.km - b.km)[0] : null
  const strongest = results.filter((f) => f.evidence_tier === 'STRONG').sort((a, b) => b.overall - a.overall)[0]
  const top = results[0]

  if (loading) {
    return <main className="grid min-h-[60vh] place-items-center bg-slate-50"><div className="flex items-center gap-3 font-bold text-slate-600"><span className="size-5 animate-spin rounded-full border-2 border-teal border-t-transparent" /> Checking evidence for nearby facilities…</div></main>
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <button onClick={onBack} className="mb-2 flex items-center gap-1 text-xs font-bold text-teal">‹ Change search</button>
            <h1 className="text-xl font-extrabold text-ink sm:text-2xl">{service?.label ?? 'Care'} near {origin?.label}</h1>
            <p className="mt-1 text-sm text-slate-500">{results.length} possible option{results.length === 1 ? '' : 's'} within {maxKm} km · ranked as <strong>{urgency.toLowerCase()}</strong> care</p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="shrink-0 text-sm font-bold text-slate-600">Sort:</label>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="min-h-11 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-ink outline-none lg:w-48">
              <option value="best">Best match</option><option value="nearest">Nearest</option><option value="evidence">Strongest evidence</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1320px] px-5 py-5 lg:px-8">
        {results.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <h2 className="text-lg font-extrabold">No facilities with evidence for {service?.label ?? 'this service'} within {maxKm} km.</h2>
            <p className="mt-2">Try a larger distance, or a nearby city or PIN code. For emergencies, call 108 for an ambulance.</p>
          </div>
        ) : (
          <>
            {closest && top && closest.facility_id !== top.facility_id && (
              <div className="mb-5 grid overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-sm sm:grid-cols-2">
                <button onClick={() => onDetail(closest)} className="flex items-center gap-3 border-b border-teal-100 p-4 text-left sm:border-b-0 sm:border-r">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icon name="pin" /></span>
                  <div><div className="text-xs font-bold uppercase tracking-wider text-slate-400">Closest</div><div className="mt-0.5 font-extrabold text-ink">{closest.km} km <span className="font-medium text-slate-400">·</span> <span className="text-slate-600">{closest.evidence_tier.toLowerCase()} evidence</span></div><div className="text-xs text-slate-500">{closest.name}</div></div>
                </button>
                <button onClick={() => onDetail(strongest ?? top)} className="flex items-center gap-3 bg-emerald-50/50 p-4 text-left">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><Icon name="shield" /></span>
                  <div><div className="text-xs font-bold uppercase tracking-wider text-emerald-700">{strongest ? 'Best verified' : 'Best match'}</div><div className="mt-0.5 font-extrabold text-ink">{(strongest ?? top).km} km <span className="font-medium text-slate-400">·</span> <span className="text-emerald-800">{(strongest ?? top).evidence_tier.toLowerCase()} evidence</span></div><div className="text-xs text-slate-500">{(strongest ?? top).name}</div></div>
                </button>
              </div>
            )}

            <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-200 p-1 lg:hidden">
              <button onClick={() => setView('list')} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-extrabold ${view === 'list' ? 'bg-white text-teal shadow-sm' : 'text-slate-600'}`}><Icon name="menu" size={18} /> List</button>
              <button onClick={() => setView('map')} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-extrabold ${view === 'map' ? 'bg-white text-teal shadow-sm' : 'text-slate-600'}`}><Icon name="pin" size={18} /> Map</button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(430px,42%)_1fr]">
              <div className={`space-y-4 ${view === 'map' ? 'hidden lg:block' : ''}`}>
                <div className="flex items-center justify-between px-1"><h2 className="font-extrabold text-ink">Recommended</h2><span className="text-xs font-semibold text-slate-400">11 factors, weighted for {urgency.toLowerCase()} care</span></div>
                {recommended.map((f) => <ResultCard key={f.facility_id} f={f} service={service} best={sort === 'best' && f.rank === 1} onDetail={() => onDetail(f)} />)}
                {recommended.length === 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">No strongly or moderately verified options in range. The options below have thin evidence — call ahead.</div>}
                {others.length > 0 && (
                  <>
                    <div className="px-1 pt-3"><h2 className="font-extrabold text-ink">Other possible options</h2><p className="text-xs font-semibold text-slate-500">Weak evidence for this service — always shown below the recommended list. Call to confirm.</p></div>
                    {others.map((f) => <ResultCard key={f.facility_id} f={f} service={service} best={false} onDetail={() => onDetail(f)} />)}
                  </>
                )}
                <p className="px-1 text-xs leading-5 text-slate-400">Travel times are estimates from distance (×1.3 for roads, 35 km/h average), not live traffic. Wait times are not reported by any source yet.</p>
              </div>
              <div className={`${view === 'list' ? 'hidden lg:block' : ''} lg:sticky lg:top-[92px] lg:h-[calc(100vh-112px)]`}>
                {origin && (
                  <Suspense fallback={<div className="grid h-full min-h-[520px] place-items-center rounded-2xl border border-slate-200 bg-slate-100 text-sm font-bold text-slate-500">Loading map…</div>}>
                    <MapView origin={origin} items={[...recommended, ...others]} onSelect={onDetail} />
                  </Suspense>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
