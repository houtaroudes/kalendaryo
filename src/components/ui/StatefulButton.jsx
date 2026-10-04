import { motion } from 'motion/react'
import { cn } from '../../lib/cn.js'

/**
 * A button that reports its own progress: idle, working, done. The label swaps
 * in place so the layout never shifts, and the control locks while busy.
 */
export function StatefulButton({ state = 'idle', children, className, ...rest }) {
  const label = { idle: children, loading: 'Booking', done: 'Booked' }[state]

  return (
    <button
      {...rest}
      disabled={state !== 'idle' || rest.disabled}
      className={cn(
        'relative inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-medium',
        'text-accent-ink transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70',
        className,
      )}
    >
      {state === 'loading' && (
        <motion.span
          className="h-3.5 w-3.5 rounded-full border-2 border-accent-ink/40 border-t-accent-ink"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
        />
      )}
      {state === 'done' && <span aria-hidden>✓</span>}
      <span>{label}</span>
    </button>
  )
}
