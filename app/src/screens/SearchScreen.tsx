import { useMemo, useState } from 'react'
import { Icon, Segmented } from '../components/ui'
import type { Budget, ConditionMapping, Insurance, SearchInput, Service, Urgency } from '../types'

export default function SearchScreen({
  services, conditions, input, setInput, onFind, saveDefaults, setSaveDefaults, autofilled, onClearProfile, error,
}: {
  services: Service[]
  conditions: ConditionMapping[]
  input: SearchInput
  setInput: (p: Partial<SearchInput>) => void
  onFind: () => void
  saveDefaults: boolean
  setSaveDefaults: (v: boolean) => void
  autofilled: boolean
  onClearProfile: () => void
  error: string | null
}) {
  const current = services.find((s) => s.service === input.service)
  const [query, setQuery] = useState(current?.label ?? '')
  const [open, setOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const byService = services.filter((s) => s.label.toLowerCase().includes(q)).map((s) => ({ from: null as string | null, s }))
    const byCondition = conditions
      .filter((c) => c.condition.includes(q))
      .map((c) => ({ from: c.condition, s: services.find((s) => s.service === c.service)! }))
      .filter((x) => x.s)
    return [...byService, ...byCondition].slice(0, 5)
  }, [query, services, conditions])

  const choose = (s: Service) => {
    setInput({ service: s.service })
    setQuery(s.label)
    setOpen(false)
  }

  const useMyLocation = () => {
    setLocError(null)
    if (!navigator.geolocation) return setLocError('Location is not available on this device.')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInput({ lat: pos.coords.latitude, lon: pos.coords.longitude, place: 'My current location' })
        setLocating(false)
      },
      () => {
        setLocError('Could not get your location. Type a PIN code instead.')
        setLocating(false)
      },
      { timeout: 10000 },
    )
  }

  const effectiveUrgency: Urgency | null = input.urgency === 'auto' ? current?.defaultUrgency ?? null : input.urgency
  const ready = !!input.service && (!!input.place.trim() || input.lat != null)

  return (
    <main>
      <section className="relative overflow-hidden border-b border-teal-100 bg-[linear-gradient(140deg,#e7f6f3_0%,#f5fbfa_55%,#eef7f8_100%)]">
        <div className="decor-circle -right-28 -top-32 size-[420px]" />
        <div className="relative mx-auto max-w-[1120px] px-5 py-10 sm:py-14 lg:px-8">
          <div className="mb-8 max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-teal shadow-sm ring-1 ring-teal-100">
              <Icon name="shield" size={15} /> Clear evidence. Better choices.
            </div>
            <h1 className="text-[34px] font-extrabold leading-[1.12] tracking-[-.035em] text-ink sm:text-5xl">
              Find care you can trust, <span className="text-teal">near you.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-7 text-slate-600">Tell us what care is needed. We’ll rank nearby hospitals and explain why each one matches.</p>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(15,110,110,.12)] sm:p-8">
            {autofilled && (
              <div className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-teal-pale px-4 py-2.5 text-sm font-semibold text-teal-dark">
                <span className="flex items-center gap-2"><Icon name="user" size={16} /> Filled in from your saved defaults</span>
                <button onClick={onClearProfile} className="text-xs font-extrabold underline underline-offset-2">Forget my defaults</button>
              </div>
            )}

            <div className="grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
              {/* 1. Need */}
              <div>
                <label htmlFor="care-search" className="mb-2.5 block text-base font-extrabold text-ink">1. What does the patient need?</label>
                <div className="relative">
                  <div className={`flex min-h-14 items-center gap-3 rounded-xl border bg-white px-4 transition ${open && suggestions.length ? 'border-teal ring-4 ring-teal/10' : 'border-slate-300'}`}>
                    <Icon name="search" className="shrink-0 text-slate-400" />
                    <input
                      id="care-search"
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setOpen(true); setInput({ service: '' }) }}
                      onFocus={() => setOpen(true)}
                      className="min-w-0 flex-1 bg-transparent text-base font-medium text-ink outline-none placeholder:text-slate-400"
                      placeholder="Condition or service, e.g. kidney failure"
                      autoComplete="off"
                    />
                    {input.service && <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Icon name="check" size={15} strokeWidth={3} /></span>}
                  </div>
                  {open && suggestions.length > 0 && !input.service && (
                    <div className="absolute top-[62px] z-20 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                      {suggestions.map(({ from, s }, i) => (
                        <button key={i} onClick={() => choose(s)} className="flex w-full items-center gap-3 border-b border-slate-100 p-3.5 text-left last:border-b-0 hover:bg-teal-pale">
                          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-pale text-teal"><Icon name={s.icon} /></span>
                          <span className="flex-1">
                            {from && <span className="block text-xs font-semibold capitalize text-slate-500">{from} may need</span>}
                            <span className="font-extrabold text-ink">{s.label}</span>
                          </span>
                          <span className="text-sm font-bold text-teal">Choose <Icon name="arrow" size={16} className="inline" /></span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-2.5 flex items-start gap-2 text-sm leading-5 text-slate-500">
                  <Icon name="info" size={16} className="mt-0.5 shrink-0" /> This tool does not diagnose. Choose the care the patient has been advised to get.
                </p>
                <div className="mt-5">
                  <div className="mb-2.5 text-sm font-bold text-slate-600">Common services</div>
                  <div className="flex flex-wrap gap-2">
                    {services.map((s) => (
                      <button key={s.service} onClick={() => choose(s)} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-bold transition active:scale-[.98] ${input.service === s.service ? 'border-teal bg-teal-pale text-teal' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-300 hover:bg-teal-pale'}`}>
                        <Icon name={s.icon} size={17} /> {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Where */}
              <div className="border-t border-slate-100 pt-7 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <label htmlFor="place-search" className="mb-2.5 block text-base font-extrabold text-ink">2. Where is the patient?</label>
                <div className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 focus-within:border-teal focus-within:ring-4 focus-within:ring-teal/10">
                  <Icon name="pin" className="shrink-0 text-slate-400" />
                  <input id="place-search" value={input.place} onChange={(e) => setInput({ place: e.target.value, lat: undefined, lon: undefined })} className="min-w-0 flex-1 bg-transparent font-medium text-ink outline-none" placeholder="PIN code, city or district" />
                  {input.lat != null && <button aria-label="Clear location" onClick={() => setInput({ place: '', lat: undefined, lon: undefined })} className="text-slate-400"><Icon name="x" size={18} /></button>}
                </div>
                <button onClick={useMyLocation} disabled={locating} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-pale font-bold text-teal transition hover:bg-teal-100 disabled:opacity-60">
                  <Icon name="location" size={19} /> {locating ? 'Finding you…' : 'Use my location'}
                </button>
                {locError && <p className="mt-2 text-sm font-semibold text-amber-800">{locError}</p>}

                <label htmlFor="max-km" className="mt-5 mb-2 block text-sm font-bold text-slate-600">Search within</label>
                <select id="max-km" value={input.maxKm} onChange={(e) => setInput({ maxKm: Number(e.target.value) })} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 font-bold text-ink outline-none">
                  {[25, 50, 100, 200, 300].map((k) => <option key={k} value={k}>{k} km</option>)}
                </select>
              </div>
            </div>

            {/* 3. Preferences */}
            <div className="mt-8 border-t border-slate-100 pt-7">
              <h2 className="mb-4 text-base font-extrabold text-ink">3. A few details <span className="font-medium text-slate-400">(changes the ranking)</span></h2>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-sm font-bold text-slate-600">How urgent is it?</div>
                  <Segmented<'auto' | Urgency> label="Urgency" value={input.urgency} onChange={(v) => setInput({ urgency: v })}
                    options={[{ value: 'auto', label: 'Usual' }, { value: 'EMERGENCY', label: 'Emergency', icon: 'zap' }, { value: 'PLANNED', label: 'Planned', icon: 'calendar' }]} />
                  {effectiveUrgency && <p className="mt-1.5 text-xs font-semibold text-slate-500">Ranking as <strong className="text-ink">{effectiveUrgency.toLowerCase()}</strong> care: {effectiveUrgency === 'EMERGENCY' ? 'speed and being open count most.' : 'evidence, cost and insurance count most.'}</p>}
                </div>
                <div>
                  <div className="mb-2 text-sm font-bold text-slate-600">When will you arrive?</div>
                  <div className="flex gap-2">
                    <div className="flex-1"><Segmented<'now' | 'later'> label="Arrival" value={input.arrival === 'now' ? 'now' : 'later'} onChange={(v) => setInput({ arrival: v === 'now' ? 'now' : '10:00' })}
                      options={[{ value: 'now', label: 'Now', icon: 'clock' }, { value: 'later', label: 'Pick a time' }]} /></div>
                    {input.arrival !== 'now' && <input type="time" aria-label="Arrival time" value={input.arrival} onChange={(e) => setInput({ arrival: e.target.value || '10:00' })} className="min-h-12 rounded-xl border border-slate-300 px-3 font-bold text-ink" />}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-bold text-slate-600">What can you pay?</div>
                  <Segmented<Budget> label="Budget" value={input.budget} onChange={(v) => setInput({ budget: v })}
                    options={[{ value: 'any', label: 'Any' }, { value: 'prefer_public', label: 'Prefer govt.' }, { value: 'free_only', label: 'Free only' }]} />
                </div>
                <div>
                  <div className="mb-2 text-sm font-bold text-slate-600">Insurance</div>
                  <Segmented<Insurance> label="Insurance" value={input.insurance} onChange={(v) => setInput({ insurance: v })}
                    options={[{ value: 'none', label: 'None' }, { value: 'govt_scheme', label: 'Ayushman / CGHS' }, { value: 'private', label: 'Private' }]} />
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-start gap-3 text-sm text-slate-600">
                <input type="checkbox" checked={saveDefaults} onChange={(e) => setSaveDefaults(e.target.checked)} className="mt-0.5 size-5 accent-[#0f6e6e]" />
                <span><strong className="text-ink">Save as my defaults</strong><br />Location, budget, insurance and distance only — never the condition. Stored on this device.</span>
              </label>
              <button onClick={onFind} disabled={!ready} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-teal px-8 text-lg font-extrabold text-white shadow-[0_8px_20px_rgba(15,110,110,.24)] transition hover:bg-teal-dark active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-64">
                Find care <Icon name="arrow" />
              </button>
            </div>
            {!input.service && query.length > 0 && <p className="mt-3 text-right text-sm font-semibold text-amber-800">Pick a service from the list to continue.</p>}
            {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>}
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-[1120px] gap-6 px-5 py-10 sm:grid-cols-3 lg:px-8">
        {[
          ['search', 'Search simply', 'Use a condition, service, city or PIN code.'],
          ['shield', 'See the evidence', 'Know exactly why a hospital was recommended.'],
          ['phone', 'Confirm before travel', 'Call the facility before you go.'],
        ].map(([icon, title, text]) => (
          <div key={title} className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-pale text-teal"><Icon name={icon} /></span>
            <div><h2 className="font-extrabold text-ink">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{text}</p></div>
          </div>
        ))}
      </section>
    </main>
  )
}
