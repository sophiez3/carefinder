import { useState } from 'react'
import { factorColor, Icon, Segmented } from '../components/ui'
import { AVG_SPEED_KMH, FACTORS, ROAD_FACTOR } from '../scoring'
import type { Urgency } from '../types'

const STEPS = [
  ['building', '10,000', 'facility records'],
  ['search', 'Match', 'the service in each listing'],
  ['shield', 'Score', 'the evidence (0–90)'],
  ['layers', 'Cross-check', 'with outside data'],
  ['pin', 'Locate', 'and estimate travel'],
  ['check', 'Rank', '11 weighted factors'],
]

const RULES = [
  ['A', 'Must offer the service', 'Facilities with no mention of the service are never shown.'],
  ['B', 'Weak evidence goes last', 'WEAK-evidence facilities always appear below the others, under “Other possible options”, however close they are.'],
  ['C', 'Missing data is rescaled, not invented', 'Final score = points earned ÷ points possible from factors with data × 100. Wait time has no data today, so it is left out.'],
  ['D', 'Your filters come first', '“Free only” removes facilities that look private. Anything beyond your distance limit is removed.'],
  ['E', 'Unknown hours are flagged', 'At night, or in an emergency, a facility not listed as 24/7 scores low on hours and shows a “call ahead” warning.'],
]

export default function MethodScreen() {
  const [mode, setMode] = useState<Urgency>('EMERGENCY')
  const total = FACTORS.reduce((a, f) => a + (mode === 'EMERGENCY' ? f.emergency : f.planned), 0)

  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-50">
      <section className="border-b border-teal-100 bg-teal-pale">
        <div className="mx-auto max-w-[1120px] px-5 py-12 text-center lg:px-8 lg:py-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-teal shadow-sm"><Icon name="shield" size={15} /> Clear and transparent</span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">How we decided</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-7 text-slate-600">Every listing is treated as a claim to check. We score how well each claim is backed up, cross-check it with outside data, then weigh 11 factors. Emergencies favour speed; planned care favours evidence and cost.</p>
        </div>
      </section>

      <div className="mx-auto max-w-[1120px] space-y-6 px-5 py-8 lg:px-8 lg:py-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
          <h2 className="text-xl font-extrabold text-ink">From data to recommendation</h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {STEPS.map(([icon, title, subtitle]) => (
              <div key={title} className="flex items-center gap-4 rounded-xl bg-slate-50 p-4 lg:flex-col lg:text-center">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-pale text-teal"><Icon name={icon} /></span>
                <div><div className="font-extrabold text-ink">{title}</div><div className="text-xs font-semibold text-slate-500">{subtitle}</div></div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-ink">The 11 factors and their weights</h2>
              <p className="mt-1 text-sm text-slate-500">Each factor scores 0–1. Points = weight × score. Weights add up to {total}.</p>
            </div>
            <div className="sm:w-80"><Segmented<Urgency> label="Weights for" value={mode} onChange={setMode} options={[{ value: 'EMERGENCY', label: 'Emergency', icon: 'zap' }, { value: 'PLANNED', label: 'Planned', icon: 'calendar' }]} /></div>
          </div>
          <p className="mt-3 text-sm text-slate-600"><strong>Emergency by default:</strong> trauma, emergency C-section, NICU, burn care. <strong>Planned by default:</strong> dialysis, MRI, cardiac surgery. Users can switch.</p>
          <div className="mt-6 space-y-4">
            {FACTORS.map((f) => {
              const w = mode === 'EMERGENCY' ? f.emergency : f.planned
              return (
                <div key={f.key} className="grid gap-3 rounded-xl border border-slate-100 p-4 md:grid-cols-[220px_1fr]">
                  <div>
                    <div className="flex items-center gap-2 font-extrabold text-ink"><span className={`size-3 rounded-full ${factorColor(f.key)}`} /> {f.label}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${factorColor(f.key)}`} style={{ width: `${w * 4}%` }} /></div>
                      <span className="w-14 text-right text-lg font-extrabold text-ink">{w}</span>
                    </div>
                    {f.key === 'wait' && <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-500">No data yet: excluded</span>}
                  </div>
                  <div className="text-sm leading-6">
                    <p className="text-slate-700"><strong className="text-ink">Why: </strong>{f.why}</p>
                    <p className="mt-1 text-slate-500"><strong className="text-slate-700">How it’s judged: </strong>{f.rubric}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-xs text-slate-500">Travel time = straight-line distance × {ROAD_FACTOR} road factor ÷ {AVG_SPEED_KMH} km/h average. It is an estimate, not live traffic.</p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <h2 className="text-xl font-extrabold text-ink">Hard rules (applied before scoring)</h2>
            <div className="mt-5 space-y-4">
              {RULES.map(([k, title, text]) => (
                <div key={k} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal text-sm font-extrabold text-white">{k}</span>
                  <div><div className="font-extrabold text-ink">{title}</div><p className="text-sm leading-6 text-slate-600">{text}</p></div>
                </div>
              ))}
            </div>
          </section>
          <div className="space-y-6">
            <section className="rounded-2xl bg-teal p-6 text-white">
              <span className="grid size-11 place-items-center rounded-xl bg-white/15"><Icon name="layers" /></span>
              <h2 className="mt-4 text-xl font-extrabold">Evidence tiers</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-teal-50">
                <li><strong className="text-white">STRONG</strong>: named in 2+ fields, including procedures or equipment.</li>
                <li><strong className="text-white">MODERATE</strong>: 2+ fields, or procedures/equipment alone.</li>
                <li><strong className="text-white">WEAK</strong>: one soft mention only (description or specialties).</li>
              </ul>
            </section>
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-amber-950"><Icon name="info" /> What we don’t know</h2>
              <ul className="mt-4 grid grid-cols-2 gap-3 text-sm font-semibold text-amber-950">
                {['Wait times', 'Live bed availability', 'Exact opening hours', 'Prices', 'Current staffing', 'Quality of care'].map((item) => <li key={item} className="flex items-center gap-2"><span className="size-2 rounded-full bg-amber-500" />{item}</li>)}
              </ul>
            </section>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="font-extrabold text-ink">Data sources</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            <li><strong className="text-ink">Virtue Foundation India facility dataset</strong>: the base. Every recommendation cites its text.</li>
            <li><strong className="text-ink">India Post PIN Code Directory</strong> (data.gov.in, GODL): turns PIN codes into locations and checks facility coordinates.</li>
            <li><strong className="text-ink">OpenStreetMap health facilities</strong> (HOT export, © OpenStreetMap contributors, ODbL): independent confirmation that a facility exists, plus government/private ownership where tagged.</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
