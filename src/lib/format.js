export function peso(amount) {
  return `\u20b1${Number(amount).toLocaleString()}`
}

export function durationLabel(minutes) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

/** "2026-10-05" to "Mon 5 Oct". */
export function prettyDay(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Short, speakable booking code derived from the row id. */
export function referenceOf(id) {
  return `#${String(id).replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

/** "2026-10-05T14:30" to "2:30 PM". */
export function prettyTime(stamp) {
  const [h, m] = stamp.slice(11, 16).split(':').map(Number)
  const suffix = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}
