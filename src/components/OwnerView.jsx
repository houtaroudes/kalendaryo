import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import {
  listBookings,
  listAllServices,
  listWindows,
  cancelBooking,
  saveService,
  setServiceActive,
  saveWindows,
  resetLocalData,
  WEEKDAYS,
} from '../lib/api.js'
import { supabase, backend } from '../lib/supabase.js'
import { dateKeyLocal } from '../lib/time.js'
import { peso, prettyDay, prettyTime, referenceOf } from '../lib/format.js'
import { cn } from '../lib/cn.js'
import { useToasts, ToastStack } from './ui/Toast.jsx'

/**
 * Owner dashboard: the day's book, every later booking, and the two things that
 * actually change behaviour, the service menu and the opening hours. When
 * Supabase is configured the whole surface is gated behind a sign in, since the
 * database only lets a signed-in owner read or change any of it.
 */
export default function OwnerView({ onServicesChanged }) {
  const [bookings, setBookings] = useState(null)
  const [services, setServices] = useState(null)
  const [windows, setWindows] = useState(null)
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const { items: toasts, push } = useToasts()

  const today = dateKeyLocal()

  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  const signedIn = !supabase || Boolean(session)

  async function load() {
    const [bs, ss, ws] = await Promise.all([listBookings(), listAllServices(), listWindows()])
    setBookings(bs)
    setServices(ss)
    setWindows(ws)
  }

  useEffect(() => {
    if (!signedIn) return undefined
    let alive = true
    load().catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [signedIn])

  async function afterServiceChange() {
    await load()
    if (onServicesChanged) await onServicesChanged()
  }

  async function onCancel(id) {
    try {
      await cancelBooking(id)
      await load()
      push('Booking cancelled.')
    } catch (err) {
      push(err.message, 'bad')
    }
  }

  const { todays, revenue, groups } = useMemo(() => {
    const rows = (bookings ?? []).filter((b) => b.status !== 'cancelled')
    const q = query.trim().toLowerCase()
    const matched = q
      ? rows.filter((b) =>
          [b.customer_name, b.customer_email, b.service_name].some((v) => (v ?? '').toLowerCase().includes(q)),
        )
      : rows
    return {
      todays: rows.filter((b) => b.starts_at.startsWith(today)),
      revenue: rows.reduce((sum, b) => sum + (b.price ?? 0), 0),
      groups: groupByDay(matched),
    }
  }, [bookings, today, query])

  if (supabase && !session) return <SignIn />

  return (
    <div className="pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Today at the shop</h1>
          <p className="mt-1 text-sm text-slate">
            {backend === 'supabase' ? 'Live from Supabase' : 'Local demo store, nothing leaves this browser'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {backend === 'local' && (
            <button
              type="button"
              onClick={async () => {
                await resetLocalData()
                await afterServiceChange()
                push('Demo data reset.')
              }}
              className="rounded-full border border-line px-3 py-2 text-xs hover:border-ink/30"
            >
              Reset demo data
            </button>
          )}
          {supabase && (
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="rounded-full border border-line px-3 py-2 text-xs hover:border-ink/30"
            >
              Sign out
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-5 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">{error}</p>}

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Today" value={String(todays.length)} hint="bookings" />
        <Stat label="Upcoming" value={String(groups.reduce((n, g) => n + (g.key > today ? g.rows.length : 0), 0))} hint="after today" />
        <Stat label="Booked value" value={peso(revenue)} hint="confirmed only" />
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl">Bookings</h2>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or service"
            className="w-full rounded-xl border border-line bg-white/70 px-3 py-2 text-sm outline-none focus:border-accent sm:w-72"
          />
        </div>

        {bookings === null ? (
          <Skeleton rows={3} />
        ) : groups.length === 0 ? (
          <p className="mt-3 text-sm text-slate">{query ? 'Nothing matches that search.' : 'No bookings yet.'}</p>
        ) : (
          <div className="mt-4 space-y-6">
            {groups.map((group) => (
              <div key={group.key}>
                <p className="text-xs uppercase tracking-[0.15em] text-slate">
                  {group.key === today ? 'Today' : prettyDay(group.key)}
                </p>
                <ul className="mt-2 space-y-2">
                  {group.rows.map((b) => (
                    <motion.li
                      key={b.id}
                      layout
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/60 p-4"
                    >
                      <div>
                        <p className="font-medium">
                          {prettyTime(b.starts_at)} <span className="text-slate">·</span> {b.service_name}
                          <span className="ml-2 text-xs text-slate">{referenceOf(b.id)}</span>
                        </p>
                        <p className="text-sm text-slate">
                          {b.customer_name} · {b.customer_email}
                          {b.customer_phone ? ` · ${b.customer_phone}` : ''}
                        </p>
                        {b.note && <p className="mt-1 text-xs text-slate">Note: {b.note}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => onCancel(b.id)}
                        className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-accent hover:text-accent"
                      >
                        Cancel
                      </button>
                    </motion.li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl">Services</h2>
        <p className="mt-1 text-sm text-slate">What customers can book. Disabling hides it without touching past bookings.</p>
        <ServicesEditor services={services} onSaved={afterServiceChange} push={push} />
      </section>

      <section className="mt-12 pb-10">
        <h2 className="font-display text-xl">Opening hours</h2>
        <p className="mt-1 text-sm text-slate">Slots are generated from these windows, so a closed day offers nothing.</p>
        <HoursEditor windows={windows} onSaved={load} push={push} />
      </section>

      <ToastStack items={toasts} />
    </div>
  )
}

function groupByDay(rows) {
  const map = new Map()
  for (const row of rows) {
    const key = row.starts_at.slice(0, 10)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({ key, rows: list.sort((a, b) => a.starts_at.localeCompare(b.starts_at)) }))
}

/* --------------------------------------------------------------- services -- */

function ServicesEditor({ services, onSaved, push }) {
  const [draft, setDraft] = useState(services ?? [])
  const [busy, setBusy] = useState('')

  useEffect(() => setDraft(services ?? []), [services])

  function update(id, patch) {
    setDraft((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function addRow() {
    setDraft((list) => [
      ...list,
      {
        id: `new-${crypto.randomUUID()}`,
        name: '',
        blurb: '',
        duration_minutes: 30,
        price: 250,
        active: true,
        sort: list.length + 1,
      },
    ])
  }

  async function saveRow(row) {
    if (!row.name.trim()) return push('A service needs a name.', 'bad')
    if (!(Number(row.duration_minutes) > 0)) return push('Duration must be at least one minute.', 'bad')
    if (Number(row.price) < 0) return push('Price cannot be negative.', 'bad')

    setBusy(row.id)
    try {
      await saveService({ ...row, id: row.id.startsWith('new-') ? undefined : row.id })
      await onSaved()
      push('Service saved.')
    } catch (err) {
      push(err.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  async function toggle(row) {
    try {
      await setServiceActive(row.id, !row.active)
      await onSaved()
      push(row.active ? 'Service disabled.' : 'Service enabled.')
    } catch (err) {
      push(err.message, 'bad')
    }
  }

  if (services === null) return <Skeleton rows={2} />

  return (
    <div className="mt-4 space-y-3">
      {draft.map((row) => (
        <div
          key={row.id}
          className={cn(
            'grid gap-3 rounded-xl border border-line bg-white/60 p-4 sm:grid-cols-[1.6fr_1fr_0.7fr_0.7fr_auto]',
            !row.active && 'opacity-60',
          )}
        >
          <label className="block">
            <span className="text-xs text-slate">Name</span>
            <input
              value={row.name}
              onChange={(e) => update(row.id, { name: e.target.value })}
              placeholder="Signature cut"
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate">Blurb</span>
            <input
              value={row.blurb ?? ''}
              onChange={(e) => update(row.id, { blurb: e.target.value })}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate">Minutes</span>
            <input
              type="number"
              min="5"
              step="5"
              value={row.duration_minutes}
              onChange={(e) => update(row.id, { duration_minutes: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate">Price</span>
            <input
              type="number"
              min="0"
              step="10"
              value={row.price}
              onChange={(e) => update(row.id, { price: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              disabled={busy === row.id}
              onClick={() => saveRow(row)}
              className="rounded-full bg-ink px-4 py-2 text-xs text-paper disabled:opacity-50"
            >
              {busy === row.id ? 'Saving' : 'Save'}
            </button>
            {!row.id.startsWith('new-') && (
              <button
                type="button"
                onClick={() => toggle(row)}
                className="rounded-full border border-line px-3 py-2 text-xs hover:border-ink/30"
              >
                {row.active ? 'Disable' : 'Enable'}
              </button>
            )}
          </div>
        </div>
      ))}

      <button type="button" onClick={addRow} className="rounded-full border border-dashed border-line px-4 py-2 text-sm hover:border-ink/40">
        Add a service
      </button>
    </div>
  )
}

/* ----------------------------------------------------------------- hours -- */

function weekFrom(windows) {
  return Array.from({ length: 7 }, (_, i) => {
    const found = (windows ?? []).find((w) => Number(w.weekday) === i)
    return {
      weekday: i,
      open: Boolean(found),
      start: found?.start ?? '09:00',
      end: found?.end ?? '17:00',
    }
  })
}

function HoursEditor({ windows, onSaved, push }) {
  const [draft, setDraft] = useState(() => weekFrom(windows))
  const [busy, setBusy] = useState(false)

  useEffect(() => setDraft(weekFrom(windows)), [windows])

  function update(weekday, patch) {
    setDraft((list) => list.map((w) => (w.weekday === weekday ? { ...w, ...patch } : w)))
  }

  async function save() {
    for (const day of draft.filter((d) => d.open)) {
      if (day.start >= day.end) {
        return push(`${WEEKDAYS[day.weekday]} closes before it opens.`, 'bad')
      }
    }
    setBusy(true)
    try {
      await saveWindows(draft.filter((d) => d.open))
      await onSaved()
      push('Opening hours saved.')
    } catch (err) {
      push(err.message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  if (windows === null) return <Skeleton rows={2} />

  return (
    <div className="mt-4 rounded-xl border border-line bg-white/60 p-4">
      <div className="space-y-2">
        {draft.map((day) => (
          <div key={day.weekday} className="flex flex-wrap items-center gap-3">
            <label className="flex w-32 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={day.open}
                onChange={(e) => update(day.weekday, { open: e.target.checked })}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              {WEEKDAYS[day.weekday]}
            </label>
            <input
              type="time"
              value={day.start}
              disabled={!day.open}
              onChange={(e) => update(day.weekday, { start: e.target.value })}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm disabled:opacity-40"
            />
            <span className="text-slate">to</span>
            <input
              type="time"
              value={day.end}
              disabled={!day.open}
              onChange={(e) => update(day.weekday, { end: e.target.value })}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm disabled:opacity-40"
            />
            {!day.open && <span className="text-xs text-slate">Closed</span>}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-4 rounded-full bg-ink px-5 py-2 text-sm text-paper disabled:opacity-50"
      >
        {busy ? 'Saving' : 'Save hours'}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ parts -- */

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-line bg-white/60 p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-slate">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      <p className="text-xs text-slate">{hint}</p>
    </div>
  )
}

function Skeleton({ rows = 3 }) {
  return (
    <div className="mt-4 grid gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl border border-line bg-white/40" />
      ))}
    </div>
  )
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function send(event) {
    event.preventDefault()
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({ email })
    if (err) setError(err.message)
    else setSent(true)
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-line bg-white/70 p-6">
      <h1 className="font-display text-2xl">Owner sign in</h1>
      <p className="mt-2 text-sm text-slate">A one-time link goes to your email.</p>
      {sent ? (
        <p className="mt-4 rounded-xl border border-line bg-paper p-3 text-sm">Check {email} for the link.</p>
      ) : (
        <form onSubmit={send} className="mt-4 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {error && <p className="text-sm text-accent">{error}</p>}
          <button type="submit" className="w-full rounded-full bg-accent px-4 py-2 text-sm text-accent-ink">
            Send link
          </button>
        </form>
      )}
    </div>
  )
}
