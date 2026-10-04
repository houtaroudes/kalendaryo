/**
 * Data layer.
 *
 * One interface, two backends. When Supabase env vars are present every call
 * goes to Postgres; when they are not, the app falls back to a seeded local
 * store in localStorage so the booking flow and the owner editors are fully
 * usable and testable with no backend. Nothing above this file knows which one
 * is in play.
 */

import { supabase } from './supabase.js'
import { buildSlots, minutesFromStamp, stampOf, upcomingDays } from './time.js'

const SEED_SERVICES = [
  { id: 'svc-cut', name: 'Signature cut', blurb: 'Consult, wash, cut and finish.', duration_minutes: 45, price: 450, sort: 1, active: true },
  { id: 'svc-beard', name: 'Beard trim', blurb: 'Shape, line up and hot towel.', duration_minutes: 30, price: 250, sort: 2, active: true },
  { id: 'svc-combo', name: 'Cut and beard', blurb: 'The full reset, both in one sitting.', duration_minutes: 75, price: 650, sort: 3, active: true },
  { id: 'svc-color', name: 'Colour consult', blurb: 'Patch test, tone plan and pricing.', duration_minutes: 30, price: 300, sort: 4, active: true },
]

const SEED_WINDOWS = [
  { weekday: 1, start: '09:00', end: '18:00' },
  { weekday: 2, start: '09:00', end: '18:00' },
  { weekday: 3, start: '09:00', end: '18:00' },
  { weekday: 4, start: '09:00', end: '18:00' },
  { weekday: 5, start: '09:00', end: '18:00' },
  { weekday: 6, start: '09:00', end: '13:00' },
]

const LS_BOOKINGS = 'kalendaryo.bookings.v1'
const LS_SERVICES = 'kalendaryo.services.v1'
const LS_WINDOWS = 'kalendaryo.windows.v1'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

const localBookings = () => read(LS_BOOKINGS, [])
const localServices = () => read(LS_SERVICES, SEED_SERVICES)
const localWindows = () => read(LS_WINDOWS, SEED_WINDOWS)

/* --------------------------------------------------------------- reading -- */

/** Active services, for the public booking flow. */
export async function listServices() {
  if (!supabase) return localServices().filter((s) => s.active).sort((a, b) => a.sort - b.sort)
  const { data, error } = await supabase.from('services').select('*').eq('active', true).order('sort')
  if (error) throw new Error(error.message)
  return data
}

/** Every service including disabled ones, for the owner editor. */
export async function listAllServices() {
  if (!supabase) return [...localServices()].sort((a, b) => a.sort - b.sort)
  const { data, error } = await supabase.from('services').select('*').order('sort')
  if (error) throw new Error(error.message)
  return data
}

export async function listWindows() {
  if (!supabase) return [...localWindows()].sort((a, b) => a.weekday - b.weekday)
  const { data, error } = await supabase.from('availability').select('*').order('weekday')
  if (error) throw new Error(error.message)
  // The column is `finish` because `end` is a reserved word, the app wants `end`.
  return data.map((w) => ({ weekday: w.weekday, start: w.start, end: w.finish }))
}

/** Existing bookings on one day, shaped for buildSlots. */
async function takenOn(dateKey) {
  if (!supabase) {
    return localBookings()
      .filter((b) => b.starts_at.startsWith(dateKey) && b.status !== 'cancelled')
      .map((b) => ({ dateKey, start: minutesFromStamp(b.starts_at), durationMinutes: b.duration_minutes }))
  }
  const { data, error } = await supabase
    .from('bookings')
    .select('starts_at, duration_minutes, status')
    .gte('starts_at', `${dateKey}T00:00:00`)
    .lte('starts_at', `${dateKey}T23:59:59`)
  if (error) throw new Error(error.message)
  return data
    .filter((b) => b.status !== 'cancelled')
    .map((b) => ({ dateKey, start: minutesFromStamp(b.starts_at), durationMinutes: b.duration_minutes }))
}

export async function getSlots(service, dateKey) {
  const [windows, taken] = await Promise.all([listWindows(), takenOn(dateKey)])
  return buildSlots({ dateKey, windows, durationMinutes: service.duration_minutes, taken })
}

/** The next day the business is open for this service, so the picker never opens on a closed day. */
export async function firstOpenDay(service, days = 21) {
  const windows = await listWindows()
  const candidates = upcomingDays(days)
  for (const day of candidates) {
    if (buildSlots({ dateKey: day, windows, durationMinutes: service.duration_minutes }).length > 0) {
      return day
    }
  }
  return candidates[0]
}

export async function listBookings() {
  if (!supabase) return [...localBookings()].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const { data, error } = await supabase.from('bookings').select('*').order('starts_at')
  if (error) throw new Error(error.message)
  return data
}

/* --------------------------------------------------------------- writing -- */

export async function createBooking({ service, dateKey, start, customer }) {
  const row = {
    // The id is generated here rather than by the database on purpose: anon has
    // no SELECT policy on bookings, so an INSERT ... RETURNING would be denied.
    id: crypto.randomUUID(),
    service_id: service.id,
    service_name: service.name,
    starts_at: stampOf(dateKey, start),
    duration_minutes: service.duration_minutes,
    price: service.price,
    customer_name: customer.name,
    customer_email: customer.email,
    customer_phone: customer.phone ?? '',
    note: customer.note ?? '',
    status: 'confirmed',
  }

  if (!supabase) {
    if (localBookings().some((b) => b.starts_at === row.starts_at && b.status !== 'cancelled')) {
      throw new Error('That slot was just taken. Pick another time.')
    }
    const saved = { created_at: new Date().toISOString(), ...row }
    write(LS_BOOKINGS, [...localBookings(), saved])
    return saved
  }

  const { error } = await supabase.from('bookings').insert(row)
  if (error) {
    if (error.code === '23505') throw new Error('That slot was just taken. Pick another time.')
    throw new Error(error.message)
  }
  return { created_at: new Date().toISOString(), ...row }
}

export async function cancelBooking(id) {
  if (!supabase) {
    write(LS_BOOKINGS, localBookings().map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)))
    return
  }
  const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
  if (error) throw new Error(error.message)
}

/** Create or update a service. New ids are generated here so the row is known. */
export async function saveService(service) {
  const rows = localServices()
  const isNew = !service.id
  const row = {
    id: service.id ?? `svc-${crypto.randomUUID().slice(0, 8)}`,
    name: service.name.trim(),
    blurb: (service.blurb ?? '').trim(),
    duration_minutes: Number(service.duration_minutes),
    price: Number(service.price),
    sort: service.sort ?? (rows.reduce((max, s) => Math.max(max, s.sort), 0) + 1),
    active: service.active ?? true,
  }

  if (!supabase) {
    const next = isNew ? [...rows, row] : rows.map((s) => (s.id === row.id ? row : s))
    write(LS_SERVICES, next)
    return row
  }
  const { error } = await supabase.from('services').upsert(row)
  if (error) throw new Error(error.message)
  return row
}

/** Soft removal. Bookings reference a service, so rows are disabled, not deleted. */
export async function setServiceActive(id, active) {
  if (!supabase) {
    write(LS_SERVICES, localServices().map((s) => (s.id === id ? { ...s, active } : s)))
    return
  }
  const { error } = await supabase.from('services').update({ active }).eq('id', id)
  if (error) throw new Error(error.message)
}

/** Replace the whole week of opening hours. Simplest correct model for a weekly rota. */
export async function saveWindows(windows) {
  const clean = windows
    .filter((w) => w.start && w.end)
    .map((w) => ({ weekday: Number(w.weekday), start: w.start, end: w.end }))

  if (!supabase) {
    write(LS_WINDOWS, clean)
    return clean
  }
  const { error: delError } = await supabase.from('availability').delete().gte('weekday', 0)
  if (delError) throw new Error(delError.message)
  if (clean.length === 0) return clean
  const { error } = await supabase
    .from('availability')
    .insert(clean.map((w) => ({ weekday: w.weekday, start: w.start, finish: w.end })))
  if (error) throw new Error(error.message)
  return clean
}

export async function clearLocalBookings() {
  write(LS_BOOKINGS, [])
}

export async function resetLocalData() {
  write(LS_BOOKINGS, [])
  write(LS_SERVICES, SEED_SERVICES)
  write(LS_WINDOWS, SEED_WINDOWS)
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
