/** "Jaipur, Jaipur, Rajasthan" -> "Jaipur, Rajasthan" (case-insensitive de-dup). */
export function placeLabel(...parts: Array<string | null | undefined>): string {
  const seen = new Set<string>()
  return parts.filter((p): p is string => !!p && !seen.has(p.toLowerCase()) && !!seen.add(p.toLowerCase())).join(', ')
}
