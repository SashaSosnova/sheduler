/** Ignore a push event when the app later opens, so it is not shown twice. */
export function markChildTaskAlertSeen(key: string): void {
  if (!key) return
  const SEEN_KEY = 'vacation-child-task-alerts-seen-v1'
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    const seen = new Set(
      Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === 'string')
        : [],
    )
    if (seen.has(key)) return
    seen.add(key)
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    /* ignore */
  }
}
