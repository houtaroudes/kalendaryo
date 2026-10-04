import { useRef } from 'react'
import { cn } from '../../lib/cn.js'

/**
 * Card Spotlight, re-implemented in plain Tailwind on top of Aceternity's idea.
 *
 * A radial highlight follows the pointer across the card. The position lives in
 * CSS custom properties written straight to the node, so moving the mouse never
 * triggers a React render.
 */
export function SpotlightCard({ as: Tag = 'button', className, children, ...rest }) {
  const ref = useRef(null)

  function onMove(event) {
    const rect = ref.current.getBoundingClientRect()
    ref.current.style.setProperty('--x', `${event.clientX - rect.left}px`)
    ref.current.style.setProperty('--y', `${event.clientY - rect.top}px`)
  }

  return (
    <Tag
      ref={ref}
      onMouseMove={onMove}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-line bg-white/70 p-5 text-left transition-colors',
        'hover:border-ink/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(280px circle at var(--x, 50%) var(--y, 50%), rgba(226, 83, 31, 0.14), transparent 65%)',
        }}
      />
      <span className="relative block">{children}</span>
    </Tag>
  )
}
