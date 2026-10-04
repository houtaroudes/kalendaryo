import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '../../lib/cn.js'
import { dateKeyLocal } from '../../lib/time.js'
import { prettyDay } from '../../lib/format.js'

/**
 * Month calendar.
 *
 * Real day picking instead of a strip of ten buttons: closed days and past days
 * are disabled rather than hidden, so the week's shape is visible at a glance.
 * `isOpen` is supplied by the caller because only the owner's hours decide it.
 */
export default function MonthCalendar({ value, onChange, isOpen, minDateKey }) {
  const [cursor, setCursor] = useState(() => startOfMonth(value))

  const cells = buildMonth(cursor)
  const today = minDateKey ?? dateKeyLocal()

  function shift(months) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + months, 1))
  }

  return (
    <div className="rounded-2xl border border-line bg-white/60 p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="rounded-lg px-2 py-1 text-sm text-slate hover:bg-paper hover:text-ink"
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="font-display text-lg">
          {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          className="rounded-lg px-2 py-1 text-sm text-slate hover:bg-paper hover:text-ink"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-slate">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={cursor.getTime()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="mt-1 grid grid-cols-7 gap-1"
        >
          {cells.map((cell, index) => {
            if (!cell) return <span key={`lead-${index}`} />
            const open = isOpen(cell.key)
            const past = cell.key < today
            const disabled = past || !open
            const selected = cell.key === value
            return (
              <button
                key={cell.key}
                type="button"
                disabled={disabled}
                onClick={() => onChange(cell.key)}
                title={disabled ? (past ? 'Past date' : 'Closed') : prettyDay(cell.key)}
                className={cn(
                  'grid h-9 place-items-center rounded-lg border text-sm transition-colors',
                  selected
                    ? 'border-accent bg-accent text-accent-ink'
                    : open && !past
                      ? 'border-line hover:border-ink/40'
                      : 'cursor-not-allowed border-transparent text-slate/35',
                )}
              >
                {cell.day}
              </button>
            )
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function startOfMonth(dateKey) {
  const [y, m] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

/** Cells for a month grid, nulls leading and trailing to align the weekday. */
function buildMonth(cursor) {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = first.getDay()

  const cells = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ day, key })
  }
  return cells
}
