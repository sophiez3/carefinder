/**
 * SAMPLE DATA — clearly fake facilities near Jaipur, used only when the app is not connected
 * to Databricks (e.g. in the Figma Make preview). Shapes match /api/search exactly.
 */
import type { Candidate, ConditionMapping, Service } from './types'

export const SERVICES: Service[] = [
  { service: 'dialysis', label: 'Dialysis', icon: 'droplet', defaultUrgency: 'PLANNED' },
  { service: 'emergency c-section', label: 'Emergency C-section', icon: 'baby', defaultUrgency: 'EMERGENCY' },
  { service: 'nicu', label: 'NICU', icon: 'heart', defaultUrgency: 'EMERGENCY' },
  { service: 'cardiac surgery', label: 'Cardiac surgery', icon: 'pulse', defaultUrgency: 'PLANNED' },
  { service: 'mri', label: 'MRI', icon: 'scan', defaultUrgency: 'PLANNED' },
  { service: 'burn care', label: 'Burn care', icon: 'flame', defaultUrgency: 'EMERGENCY' },
  { service: 'trauma care', label: 'Trauma care', icon: 'shield', defaultUrgency: 'EMERGENCY' },
]

export const CONDITIONS: ConditionMapping[] = [
  { condition: 'kidney failure', service: 'dialysis' },
  { condition: 'chronic kidney disease', service: 'dialysis' },
  { condition: 'ckd', service: 'dialysis' },
  { condition: 'obstructed labour', service: 'emergency c-section' },
  { condition: 'high-risk pregnancy', service: 'emergency c-section' },
  { condition: 'breech baby', service: 'emergency c-section' },
  { condition: 'premature baby', service: 'nicu' },
  { condition: 'newborn breathing problem', service: 'nicu' },
  { condition: 'low birth weight', service: 'nicu' },
  { condition: 'blocked arteries', service: 'cardiac surgery' },
  { condition: 'heart valve disease', service: 'cardiac surgery' },
  { condition: 'brain scan', service: 'mri' },
  { condition: 'spine injury scan', service: 'mri' },
  { condition: 'burn injury', service: 'burn care' },
  { condition: 'fire injury', service: 'burn care' },
  { condition: 'road accident', service: 'trauma care' },
  { condition: 'head injury', service: 'trauma care' },
  { condition: 'fracture from fall', service: 'trauma care' },
]

export const SAMPLE_ORIGIN = { label: '302001 (Jaipur)', lat: 26.9196, lon: 75.7878, district: 'JAIPUR', state: 'RAJASTHAN' }

const base = {
  city: 'Jaipur', state: 'Rajasthan', address: null, phone: null, year_est: null, wait_minutes: null,
  osm_url: null, source_urls: ['https://example.org/sample-listing'], flags: [] as string[],
}

function km(lat: number, lon: number) {
  const R = 6371, toR = Math.PI / 180
  const dLat = (lat - SAMPLE_ORIGIN.lat) * toR, dLon = (lon - SAMPLE_ORIGIN.lon) * toR
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(SAMPLE_ORIGIN.lat * toR) * Math.cos(lat * toR) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10
}

type Raw = Omit<Candidate, 'km' | keyof typeof base> & Partial<typeof base>
const raw: Raw[] = [
  { facility_id: 's1', name: 'Sample Government Hospital', district: 'Jaipur', lat: 26.84, lon: 75.92,
    evidence_score: 80, evidence_tier: 'STRONG', matched_fields: ['procedures', 'equipment', 'description'],
    evidence_quotes: ['…24-hour haemodialysis unit with 6 machines…', '…department of nephrology provides renal care…'],
    location_confidence: 'HIGH', is_24x7: true, ownership: 'PUBLIC', ownership_source: 'OpenStreetMap',
    mentions_govt_scheme: true, mentions_private_insurance: false, has_specialist: true, has_equipment: true,
    doctors_n: 18, beds_n: 120, verification: 'HIGH', verification_sources: ['OpenStreetMap'] },
  { facility_id: 's2', name: 'Sample Multispeciality Pvt Ltd', district: 'Jaipur', lat: 26.89, lon: 75.81,
    evidence_score: 70, evidence_tier: 'STRONG', matched_fields: ['procedures', 'equipment'],
    evidence_quotes: ['…dialysis machines available, cashless for major insurers…'],
    location_confidence: 'HIGH', is_24x7: true, ownership: 'PRIVATE', ownership_source: 'listing keywords',
    mentions_govt_scheme: false, mentions_private_insurance: true, has_specialist: true, has_equipment: true,
    doctors_n: 35, beds_n: 200, verification: 'MEDIUM', verification_sources: ['OpenStreetMap'] },
  { facility_id: 's3', name: 'Sample District Hospital', district: 'Jaipur Rural', lat: 27.05, lon: 75.62,
    evidence_score: 45, evidence_tier: 'MODERATE', matched_fields: ['description', 'capability/specialties'],
    evidence_quotes: ['…dialysis and nephrology services available…'],
    location_confidence: 'APPROX (PIN centroid)', flags: ['USING_PIN_CENTROID'], is_24x7: false, ownership: 'PUBLIC',
    ownership_source: 'OpenStreetMap', mentions_govt_scheme: true, mentions_private_insurance: false,
    has_specialist: false, has_equipment: true, doctors_n: null, beds_n: 60, verification: 'HIGH',
    verification_sources: ['OpenStreetMap'] },
  { facility_id: 's4', name: 'Sample Kidney Care Clinic', district: 'Jaipur', lat: 26.93, lon: 75.77,
    evidence_score: 55, evidence_tier: 'MODERATE', matched_fields: ['procedures'],
    evidence_quotes: ['…outpatient haemodialysis by appointment…'],
    location_confidence: 'HIGH', is_24x7: false, ownership: 'UNKNOWN', ownership_source: 'unknown',
    mentions_govt_scheme: true, mentions_private_insurance: false, has_specialist: true, has_equipment: false,
    doctors_n: 4, beds_n: null, verification: null, verification_sources: [] },
  { facility_id: 's5', name: 'Sample Care Centre', district: 'Jaipur', lat: 26.95, lon: 75.8,
    evidence_score: 20, evidence_tier: 'WEAK', matched_fields: ['capability/specialties'],
    evidence_quotes: ['…multi-specialty care including renal medicine…'],
    location_confidence: 'LOW (conflicting)', flags: ['LOCATION_MISMATCH', 'THIN_EVIDENCE'], is_24x7: false,
    ownership: 'UNKNOWN', ownership_source: 'unknown', mentions_govt_scheme: false, mentions_private_insurance: false,
    has_specialist: false, has_equipment: false, doctors_n: null, beds_n: null, verification: null, verification_sources: [] },
]

/** Sample candidates for any service: same 5 fake facilities, relabelled. */
export function sampleCandidates(): Candidate[] {
  return raw.map((r) => ({ ...base, ...r, km: km(r.lat, r.lon) }) as Candidate)
}
