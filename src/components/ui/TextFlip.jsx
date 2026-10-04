import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

/**
 * Container Text Flip: one word swaps for the next on a timer, the container
 * animating its width so the line never jumps. A local re-implementation of the
 * Aceternity effect.
 */
export function TextFlip({ words, interval = 2600, className = '' }) {
  const [index, setIndex] = useState(0)
  // The widest word sets the box width, so a longer incoming word can never
  // overflow onto the text after it and the line never shifts.
  const widest = words.reduce((a, b) => (a.length >= b.length ? a : b), '')

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), interval)
    return () => clearInterval(id)
  }, [words.length, interval])

  return (
    <>
      {/*
       * The rotating words are decorative: a screen reader would otherwise
       * announce every word that has passed through. The visual layer is hidden
       * and one stable word is exposed beside it.
       */}
      <span className="sr-only">{words[0]}</span>
      <span aria-hidden="true" className={`relative inline-grid align-bottom ${className}`}>
        <span className="col-start-1 row-start-1 invisible">{widest}</span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={words[index]}
            initial={{ y: '0.6em', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-0.6em', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="col-start-1 row-start-1 whitespace-nowrap text-accent"
          >
            {words[index]}
          </motion.span>
        </AnimatePresence>
      </span>
    </>
  )
}
