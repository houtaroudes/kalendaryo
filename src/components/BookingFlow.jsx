import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { getSlots, createBooking, firstOpenDay, listWindows } from '../lib/api.js'
import { dateKeyLocal, weekdayOf } from '../lib/time.js'
import { peso, durationLabel, prettyDay, prettyTime, referenceOf } from '../lib/format.js'
import { cn } from '../lib/cn.js'
import { SpotlightCard } from './ui/SpotlightCard.jsx'
import { TextFlip } from './ui/TextFlip.jsx'
import { StatefulButton } from './ui/StatefulButton.jsx'
import MonthCalendar from './ui/MonthCalendar.jsx'

const STEPS = ['service', 'time', 'details', 'done']

/**
 * The public booking flow: pick a service, pick a day and time, leave details,
 * confirm. One component owns the whole sequence so going back never loses
 * earlier choices.
 */
export default function BookingFlow({ services }) {
  const [step, setStep] = useState('service')
  const [service, setService] = useState(null)
  const [dateKey, setDateKey] = useState(dateKeyLocal())
  const [slots, setSlots] = useState(null)
  const [chosen, setChosen] = useState(null)
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', note: '' })
  const [buttonState, setButtonState] = useState('idle')
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(null)
  const [openWeekdays, setOpenWeekdays] = useState(new Set())

  // The calendar disables closed days, so it needs the opening hours up front.
  useEffect(() => {
    let alive = true
    listWindows()
      .then((ws) => alive && setOpenWeekdays(new Set(ws.map((w) => Number(w.weekday)))))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!service) return undefined
    let alive = true
    setSlots(null)
    getSlots(service, dateKey)
      .then((rows) => alive && setSlots(rows))
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [service, dateKey])

  async function pickService(next) {
    setService(next)
    setChosen(null)
    setError('')
    setStep('time')
    // Open on the first day that actually has slots, so a closed day is never the first thing seen.
    setDateKey(await firstOpenDay(next))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setButtonState('loading')
    try {
      const saved = await createBooking({ service, dateKey, start: chosen.start, customer })
      setConfirmed(saved)
      setButtonState('done')
      setStep('done')
    } catch (err) {
      setError(err.message)
      setButtonState('idle')
    }
  }

  function restart() {
    setStep('service')
    setService(null)
    setChosen(null)
    setConfirmed(null)
    setButtonState('idle')
    setCustomer({ name: '', email: '', phone: '', note: '' })
  }

  const stepIndex = STEPS.indexOf(step)

  return (
    <div>
      <section className="pt-6 pb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-slate">Barber and salon booking</p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          Book a <TextFlip words={['cut', 'trim', 'reset', 'slot']} /> in under a minute.
        </h1>
        <p className="mt-4 max-w-xl text-slate">
          Pick a service, choose an open time, and it is held for you. No account, no back and forth.
        </p>
      </section>

      <Stepper index={stepIndex} />

      {error && (
        <p className="mt-5 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-ink">{error}</p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className="mt-6"
        >
          {step === 'service' && <ServiceStep services={services} onPick={pickService} />}

          {step === 'time' && (
            <TimeStep
              service={service}
              dateKey={dateKey}
              onDate={setDateKey}
              slots={slots}
              chosen={chosen}
              onChoose={setChosen}
              openWeekdays={openWeekdays}
              onBack={() => setStep('service')}
              onNext={() => setStep('details')}
            />
          )}

          {step === 'details' && (
            <DetailsStep
              service={service}
              dateKey={dateKey}
              chosen={chosen}
              customer={customer}
              onChange={setCustomer}
              onBack={() => setStep('time')}
              onSubmit={submit}
              buttonState={buttonState}
            />
          )}

          {step === 'done' && <DoneStep booking={confirmed} onRestart={restart} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Stepper({ index }) {
  const labels = ['Service', 'Time', 'Details', 'Done']
  return (
    <ol className="flex items-center gap-2 text-xs">
      {labels.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              'grid h-6 w-6 place-items-center rounded-full border text-[11px] transition-colors',
              i <= index ? 'border-accent bg-accent text-accent-ink' : 'border-line text-slate',
            )}
          >
            {i + 1}
          </span>
          <span className={i <= index ? 'text-ink' : 'text-slate'}>{label}</span>
          {i < labels.length - 1 && <span className="mx-1 h-px w-6 bg-line" />}
        </li>
      ))}
    </ol>
  )
}

function ServiceStep({ services, onPick }) {
  if (!services) return <Skeleton rows={4} />
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {services.map((service) => (
        <SpotlightCard key={service.id} onClick={() => onPick(service)}>
          <h3 className="text-lg font-medium">{service.name}</h3>
          <p className="mt-1 text-sm text-slate">{service.blurb}</p>
          <p className="mt-4 flex items-center gap-3 text-sm">
            <span className="rounded-full bg-ink px-3 py-1 text-paper">{durationLabel(service.duration_minutes)}</span>
            <span className="text-ink">{peso(service.price)}</span>
          </p>
        </SpotlightCard>
      ))}
    </div>
  )
}

function TimeStep({ service, dateKey, onDate, slots, chosen, onChoose, openWeekdays, onBack, onNext }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <h2 className="font-display text-xl">{service.name}</h2>
        <p className="mt-1 text-sm text-slate">
          {durationLabel(service.duration_minutes)} · {peso(service.price)}
        </p>
        <div className="mt-4">
          <MonthCalendar
            value={dateKey}
            onChange={(day) => {
              onDate(day)
              onChoose(null)
            }}
            isOpen={(key) => openWeekdays.has(weekdayOf(key))}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate">Open times on {prettyDay(dateKey)}</h3>
        {slots === null ? (
          <Skeleton rows={2} />
        ) : slots.length === 0 ? (
          <p className="mt-3 rounded-xl border border-line bg-white/60 p-4 text-sm text-slate">
            Nothing open that day. Try another date.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((slot) => (
              <button
                key={slot.start}
                type="button"
                onClick={() => onChoose(slot)}
                className={cn(
                  'rounded-lg border px-2 py-2 text-xs transition-colors',
                  chosen?.start === slot.start
                    ? 'border-accent bg-accent text-accent-ink'
                    : 'border-line hover:border-ink/30',
                )}
              >
                {slot.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onBack} className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink/30">
            Back
          </button>
          <button
            type="button"
            disabled={!chosen}
            onClick={onNext}
            className="rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailsStep({ service, dateKey, chosen, customer, onChange, onBack, onSubmit, buttonState }) {
  const set = (key) => (event) => onChange({ ...customer, [key]: event.target.value })
  const valid = customer.name.trim() && /\S+@\S+\.\S+/.test(customer.email)

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <aside className="rounded-2xl border border-line bg-white/60 p-5">
        <h2 className="font-display text-xl">{service.name}</h2>
        <dl className="mt-3 space-y-1 text-sm text-slate">
          <div className="flex justify-between"><dt>When</dt><dd className="text-ink">{prettyDay(dateKey)}, {chosen.label}</dd></div>
          <div className="flex justify-between"><dt>Length</dt><dd className="text-ink">{durationLabel(service.duration_minutes)}</dd></div>
          <div className="flex justify-between"><dt>Price</dt><dd className="text-ink">{peso(service.price)}</dd></div>
        </dl>
      </aside>

      <div className="space-y-4">
        <Field label="Your name" value={customer.name} onChange={set('name')} required />
        <Field label="Email" type="email" value={customer.email} onChange={set('email')} required />
        <Field label="Phone" value={customer.phone} onChange={set('phone')} />
        <label className="block">
          <span className="text-sm text-slate">Anything to know before you arrive</span>
          <textarea
            rows={3}
            value={customer.note}
            onChange={set('note')}
            className="mt-1 w-full rounded-xl border border-line bg-white/70 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>

        <div className="flex items-center gap-2 pt-2">
          <button type="button" onClick={onBack} className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink/30">
            Back
          </button>
          <StatefulButton type="submit" state={buttonState} disabled={!valid}>
            Confirm booking
          </StatefulButton>
        </div>
      </div>
    </form>
  )
}

function DoneStep({ booking, onRestart }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border border-line bg-white/70 p-8"
    >
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Confirmed</p>
      <h2 className="mt-2 font-display text-3xl">You are booked.</h2>
      <p className="mt-3 text-slate">
        {booking?.service_name} on {booking ? prettyDay(booking.starts_at.slice(0, 10)) : ''} at{' '}
        {booking ? prettyTime(booking.starts_at) : ''}.
      </p>
      <p className="mt-1 text-sm text-slate">
        A confirmation goes to {booking?.customer_email}.
        {booking?.id && <span className="ml-2 text-ink">Reference {referenceOf(booking.id)}</span>}
      </p>
      <button type="button" onClick={onRestart} className="mt-6 rounded-full bg-ink px-4 py-2 text-sm text-paper">
        Book another
      </button>
    </motion.div>
  )
}

function Field({ label, type = 'text', ...rest }) {
  return (
    <label className="block">
      <span className="text-sm text-slate">{label}</span>
      <input
        {...rest}
        type={type}
        className="mt-1 w-full rounded-xl border border-line bg-white/70 px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
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
