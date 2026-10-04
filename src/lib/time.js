/**
 * Pure time helpers for slot generation.
 *
 * Everything works in minutes from midnight and local date keys, so there is no
 * timezone drift between the browser, the tests and the database. These are the
 * functions the booking logic is built on, and they carry no React or network
 * dependency on purpose.
 */

/** Local calendar date as YYYY-MM-DD, not the UTC one. */
export function dateKeyLocal(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Day of week for a date key, 0 is Sunday. */
export function weekdayOf(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** "09:30" to 570. */
export function minutesOf(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** 570 to "9:30 AM". */
export function labelOf(minutes) {
  const h24 = Math.floor(minutes / 60)
  const m = minutes % 60
  const suffix = h24 < 12 ? 'AM' : 'PM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** ISO-ish local timestamp "YYYY-MM-DDTHH:MM" for storing a booking start. */
export function stampOf(dateKey, minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${dateKey}T${h}:${m}`
}

/** Minutes from midnight of a stored timestamp. */
export function minutesFromStamp(stamp) {
  return minutesOf(stamp.slice(11, 16))
}

/** A week of date keys starting today, for the day picker. */
export function upcomingDays(count = 14, from = new Date()) {
  const out = []
  for (let i = 0; i < count; i += 1) {
    const d = new Date(from)
    d.setDate(d.getDate() + i)
    out.push(dateKeyLocal(d))
  }
  return out
}

/**
 * Available start times for one day.
 *
 * A slot is offered only when the whole service duration fits inside an opening
 * window and does not overlap an existing booking. `taken` is a list of
 * { start, durationMinutes }.
 */
export function buildSlots({ dateKey, windows, durationMinutes, taken = [], step = null }) {
  const weekday = weekdayOf(dateKey)
  const grid = step ?? durationMinutes
  const busy = taken
    .filter((b) => b.dateKey === dateKey)
    .map((b) => [b.start, b.start + b.durationMinutes])

  const slots = []
  for (const w of windows) {
    if (w.weekday !== weekday) continue
    const open = minutesOf(w.start)
    const close = minutesOf(w.end)
    for (let start = open; start + durationMinutes <= close; start += grid) {
      const end = start + durationMinutes
      const clash = busy.some(([s, e]) => start < e && end > s)
      if (!clash) slots.push({ start, label: labelOf(start) })
    }
  }
  return slots.sort((a, b) => a.start - b.start)
}
