import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect } from 'react'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import type { Origin, ScoredFacility } from '../types'

const TIER_COLOR = { STRONG: '#047857', MODERATE: '#d97706', WEAK: '#475569' }

function pin(rank: number, tier: keyof typeof TIER_COLOR, active: boolean) {
  const size = active ? 46 : 38
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;background:${TIER_COLOR[tier]};border:3px solid white;border-radius:999px;display:grid;place-items:center;color:white;font:800 ${active ? 16 : 14}px Inter,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.25)">${rank}</div>`,
  })
}

function FitBounds({ origin, items }: { origin: Origin; items: ScoredFacility[] }) {
  const map = useMap()
  useEffect(() => {
    const pts: L.LatLngExpression[] = [[origin.lat, origin.lon], ...items.map((f) => [f.lat, f.lon] as L.LatLngExpression)]
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 13 })
  }, [map, origin, items])
  return null
}

export default function MapView({ origin, items, activeId, onSelect }: {
  origin: Origin
  items: ScoredFacility[]
  activeId?: string
  onSelect: (f: ScoredFacility) => void
}) {
  return (
    <div className="relative h-full min-h-[520px] overflow-hidden rounded-2xl border border-slate-200">
      <MapContainer center={[origin.lat, origin.lon]} zoom={11} scrollWheelZoom className="h-full min-h-[520px] w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds origin={origin} items={items} />
        <CircleMarker center={[origin.lat, origin.lon]} radius={9} pathOptions={{ color: '#0f6e6e', fillColor: '#0f6e6e', fillOpacity: 0.9, weight: 4 }}>
          <Popup>Patient location: {origin.label}</Popup>
        </CircleMarker>
        {items.map((f) => (
          <Marker key={f.facility_id} position={[f.lat, f.lon]} icon={pin(f.rank, f.evidence_tier, f.facility_id === activeId)} eventHandlers={{ click: () => onSelect(f) }}>
            <Popup>
              <strong>{f.rank}. {f.name}</strong>
              <br />
              {f.km} km · ~{f.travelMin} min · {f.evidence_tier.toLowerCase()} evidence
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex gap-3 rounded-lg bg-white/95 px-3 py-2 text-[11px] font-bold text-slate-600 shadow">
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-emerald-700" /> Strong</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-amber-600" /> Moderate</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-slate-600" /> Weak</span>
        <span className="text-slate-400">Pins at listed location · not live traffic</span>
      </div>
    </div>
  )
}
