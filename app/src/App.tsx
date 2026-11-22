import { useEffect, useMemo, useState } from 'react'
import { detectMode, loadServices, search } from './api'
import { Header, SampleBanner } from './components/ui'
import { clearProfile, DEFAULT_PROFILE, loadProfile, saveProfile } from './profile'
import { CONDITIONS, SERVICES } from './sampleData'
import { rank, resolveUrgency } from './scoring'
import DetailScreen from './screens/DetailScreen'
import MethodScreen from './screens/MethodScreen'
import ResultsScreen from './screens/ResultsScreen'
import SearchScreen from './screens/SearchScreen'
import type { Candidate, ConditionMapping, Origin, ScoredFacility, Screen, SearchInput, Service } from './types'

function initialInput(): { input: SearchInput; autofilled: boolean } {
  const p = loadProfile()
  const prof = p ?? DEFAULT_PROFILE
  return {
    autofilled: !!p,
    input: { service: '', place: prof.homePlace, urgency: 'auto', arrival: 'now', budget: prof.budget, insurance: prof.insurance, maxKm: prof.maxKm },
  }
}

export default function App() {
  const init = useMemo(initialInput, [])
  const [screen, setScreen] = useState<Screen>('search')
  const [mode, setMode] = useState<'live' | 'sample' | null>(null)
  const [services, setServices] = useState<Service[]>(SERVICES)
  const [conditions, setConditions] = useState<ConditionMapping[]>(CONDITIONS)
  const [input, setInputState] = useState<SearchInput>(init.input)
  const [autofilled, setAutofilled] = useState(init.autofilled)
  const [saveDefaults, setSaveDefaults] = useState(init.autofilled)
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<ScoredFacility | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    detectMode().then(setMode)
    loadServices().then(({ services, conditions }) => {
      setServices(services)
      setConditions(conditions)
    })
  }, [])

  const setInput = (p: Partial<SearchInput>) => setInputState((prev) => ({ ...prev, ...p }))
  const service = services.find((s) => s.service === input.service)
  const urgency = resolveUrgency(input, service?.defaultUrgency ?? 'PLANNED')
  const results = useMemo(() => rank(candidates, input, urgency), [candidates, input, urgency])

  const onFind = async () => {
    setError(null)
    if (saveDefaults) {
      saveProfile({ homePlace: input.lat != null ? '' : input.place, budget: input.budget, insurance: input.insurance, maxKm: input.maxKm })
    }
    setLoading(true)
    setScreen('results')
    window.scrollTo(0, 0)
    try {
      const r = await search(input)
      setOrigin(r.origin)
      setCandidates(r.candidates)
    } catch (e) {
      const msg = (e as { userFacing?: boolean; message?: string }).userFacing ? (e as Error).message : 'Could not reach the search service. Check your connection and try again.'
      setError(msg)
      setScreen('search')
    } finally {
      setLoading(false)
    }
  }

  const go = (s: Screen) => {
    if ((s === 'results' || s === 'detail') && !origin) return setScreen('search')
    setScreen(s)
    window.scrollTo(0, 0)
  }

  return (
    <div className="min-h-screen bg-white">
      <Header screen={screen} setScreen={go} />
      {mode === 'sample' && <SampleBanner />}
      {screen === 'search' && (
        <SearchScreen
          services={services}
          conditions={conditions}
          input={input}
          setInput={setInput}
          onFind={onFind}
          saveDefaults={saveDefaults}
          setSaveDefaults={setSaveDefaults}
          autofilled={autofilled}
          onClearProfile={() => { clearProfile(); setAutofilled(false); setSaveDefaults(false) }}
          error={error}
        />
      )}
      {screen === 'results' && (
        <ResultsScreen origin={origin} results={results} service={service} urgency={urgency} maxKm={input.maxKm} loading={loading}
          onDetail={(f) => { setSelected(f); go('detail') }} onBack={() => go('search')} />
      )}
      {screen === 'detail' && selected && (
        <DetailScreen f={results.find((r) => r.facility_id === selected.facility_id) ?? selected} service={service} urgency={urgency} goBack={() => go('results')} />
      )}
      {screen === 'method' && <MethodScreen />}
    </div>
  )
}
