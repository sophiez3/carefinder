/**
 * Profile autofill. Saved only in this browser, and only if the user ticks "Save as my defaults".
 * Deliberately stores NO health information — just place, budget, insurance and distance.
 */
import type { Profile } from './types'

const KEY = 'carefinder.profile.v1'

export const DEFAULT_PROFILE: Profile = { homePlace: '', budget: 'any', insurance: 'none', maxKm: 100 }

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : null
  } catch {
    return null
  }
}

export function saveProfile(p: Profile): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
    return true
  } catch {
    return false
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}
