import { useCallback, useEffect, useState } from 'react'
import { motion, MotionConfig } from 'motion/react'
import { cn } from './lib/cn.js'
import { listServices } from './lib/api.js'
import BookingFlow from './components/BookingFlow.jsx'
import OwnerView from './components/OwnerView.jsx'

/**
 * App shell. Two surfaces: the public booking flow and the owner dashboard.
 * Routing is a hash so the app works on any static host with no router dep.
 * MotionConfig with reducedMotion="user" makes every animation in the tree
 * respect the operating system's reduced motion setting.
 */
export default function App() {
  const [route, setRoute] = useState(() => window.location.hash.replace('#', '') || 'book')
  const [services, setServices] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace('#', '') || 'book')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const refreshServices = useCallback(
    () =>
      listServices()
        .then((rows) => {
          setServices(rows)
          return rows
        })
        .catch((err) => {
          setError(err.message)
          return []
        }),
    [],
  )

  useEffect(() => {
    refreshServices()
  }, [refreshServices])

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-full">
        <Header route={route} onChange={(next) => (window.location.hash = next)} />
        <main className="mx-auto w-full max-w-5xl px-5 pb-24">
          {error ? (
            <p className="mt-10 rounded-xl border border-line bg-white/60 p-5 text-slate">{error}</p>
          ) : route === 'owner' ? (
            <OwnerView onServicesChanged={refreshServices} />
          ) : (
            <BookingFlow services={services} />
          )}
        </main>
      </div>
    </MotionConfig>
  )
}

function Header({ route, onChange }) {
  const tabs = [
    { id: 'book', label: 'Book a slot' },
    { id: 'owner', label: 'Owner' },
  ]

  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6">
      <button
        type="button"
        onClick={() => onChange('book')}
        className="font-display text-2xl tracking-tight text-ink"
      >
        Kalendaryo<span className="text-accent">.</span>
      </button>
      <nav className="flex items-center gap-1 rounded-full border border-line bg-white/70 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative rounded-full px-4 py-2 text-sm transition-colors',
              route === tab.id ? 'text-accent-ink' : 'text-slate hover:text-ink',
            )}
          >
            {route === tab.id && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        ))}
      </nav>
    </header>
  )
}
