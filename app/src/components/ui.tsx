import type { ReactNode } from 'react'
import type { Screen, Tier } from '../types'

export function Icon({
  name,
  size = 20,
  strokeWidth = 2,
  className = '',
}: {
  name: string
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    location: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /><circle cx="12" cy="12" r="8" /></>,
    arrow: <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></>,
    phone: <path d="M5 4h4l2 5-3 2a15 15 0 0 0 5 5l2-3 5 2v4c0 1-1 2-2 2C10 20 4 14 3 6c0-1 1-2 2-2Z" />,
    directions: <><path d="m12 3 9 9-9 9-9-9 9-9Z" /><path d="M9 15v-3h6m-2-2 2 2-2 2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    building: <><path d="M5 21V5l7-3 7 3v16M9 9h1m4 0h1M9 13h1m4 0h1M9 17h6" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-5" /></>,
    droplet: <path d="M12 2S6 9 6 14a6 6 0 0 0 12 0c0-5-6-12-6-12Z" />,
    baby: <><circle cx="12" cy="8" r="4" /><path d="M7 21v-3a5 5 0 0 1 10 0v3M10 8h.1m3.9 0h.1" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    pulse: <><path d="M3 12h4l2-5 4 10 2-5h6" /></>,
    scan: <><path d="M8 3H4v4m12-4h4v4M8 21H4v-4m12 4h4v-4" /><circle cx="12" cy="12" r="4" /></>,
    flame: <path d="M12 22c4 0 7-3 7-7 0-3-2-7-5-10 0 3-2 4-3 5 0-3-1-5-3-7 0 5-3 7-3 12 0 4 3 7 7 7Z" />,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5m-18 5 9 5 9-5" /></>,
    external: <><path d="M14 4h6v6m0-6-9 9" /><path d="M19 13v6H5V5h6" /></>,
    warning: <><path d="M12 3 2 21h20L12 3Z" /><path d="M12 9v5m0 3v.1" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    bed: <><path d="M3 6v15m18 0v-8H3m4 0V8h5a4 4 0 0 1 4 4v1" /></>,
    wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 15h2" /></>,
    moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    zap: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  }
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] ?? paths.info}
    </svg>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-10 place-items-center rounded-xl bg-teal text-white shadow-sm">
        <Icon name="heart" size={22} />
      </span>
      <div>
        <div className="text-[19px] font-extrabold leading-5 tracking-tight text-ink">CareFinder <span className="text-teal">India</span></div>
        <div className="hidden text-[11px] font-medium text-slate-500 sm:block">Care choices, made clearer</div>
      </div>
    </div>
  )
}

export function EvidenceBadge({ level }: { level: Tier }) {
  const key = level.toLowerCase() as 'strong' | 'moderate' | 'weak'
  const styles = {
    strong: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    moderate: 'bg-amber-50 text-amber-800 border-amber-200',
    weak: 'bg-slate-100 text-slate-700 border-slate-200',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold tracking-[.08em] ${styles[key]}`}>
      <Icon name={key === 'strong' ? 'check' : key === 'moderate' ? 'info' : 'layers'} size={14} strokeWidth={2.5} />
      {level} EVIDENCE
    </span>
  )
}

export function WarningChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
      <Icon name="warning" size={13} /> {children}
    </span>
  )
}

export function Header({ screen, setScreen }: { screen: Screen; setScreen: (s: Screen) => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between px-5 lg:px-8">
        <button onClick={() => setScreen('search')} aria-label="Go to search"><Logo /></button>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {([
            ['search', 'Search'],
            ['results', 'Results'],
            ['method', 'How we decide'],
          ] as [Screen, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setScreen(id)} className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${screen === id || (id === 'results' && screen === 'detail') ? 'bg-teal-pale text-teal' : 'text-slate-600 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </nav>
        <button onClick={() => setScreen('method')} className="grid size-11 place-items-center rounded-xl border border-slate-200 text-slate-700 md:hidden" aria-label="How we decide">
          <Icon name="menu" />
        </button>
      </div>
    </header>
  )
}


export function SampleBanner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-bold text-amber-900">
      SAMPLE MODE — not connected to Databricks. Facilities shown are fictional examples.
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string; icon?: string }>
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-bold transition ${value === o.value ? 'bg-white text-teal shadow-sm' : 'text-slate-600 hover:text-ink'}`}
        >
          {o.icon && <Icon name={o.icon} size={16} />} {o.label}
        </button>
      ))}
    </div>
  )
}

const BAR_COLORS: Record<string, string> = {
  travel: 'bg-teal', evidence: 'bg-emerald-600', hours: 'bg-sky-600', wait: 'bg-slate-400',
  specialist: 'bg-indigo-500', equipment: 'bg-violet-500', verification: 'bg-cyan-600',
  cost: 'bg-amber-500', insurance: 'bg-orange-500', location: 'bg-slate-500', capacity: 'bg-stone-400',
}

/** Stacked bar: how many points each factor contributed. */
export function ScoreBar({ factors, possible }: { factors: Array<{ key: string; label: string; points: number }>; possible: number }) {
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Points by factor">
        {factors.filter((f) => f.points > 0).map((f) => (
          <div key={f.key} title={`${f.label}: ${f.points} pts`} className={`${BAR_COLORS[f.key] ?? 'bg-slate-400'} h-full border-r border-white/60 last:border-r-0`} style={{ width: `${(f.points / possible) * 100}%` }} />
        ))}
      </div>
    </div>
  )
}

export function factorColor(key: string) {
  return BAR_COLORS[key] ?? 'bg-slate-400'
}
