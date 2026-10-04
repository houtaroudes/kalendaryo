import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '../../lib/cn.js'

/** Toast state. Kept tiny: push a message, it clears itself after a few seconds. */
export function useToasts() {
  const [items, setItems] = useState([])

  const push = useCallback((message, tone = 'ok') => {
    const id = crypto.randomUUID()
    setItems((list) => [...list, { id, message, tone }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 3200)
  }, [])

  return { items, push }
}

/** Fixed stack, out of the way of the page and non-interactive. */
export function ToastStack({ items }) {
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.p
            key={t.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            role="status"
            className={cn(
              'rounded-full border px-4 py-2 text-sm',
              t.tone === 'bad' ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-white text-ink',
            )}
          >
            {t.message}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  )
}
