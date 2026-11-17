import { useHud, useView } from '../state/hud'
import './hint.css'

/** The warning hint, bottom centre, between the globe and the keys: shown while the alarm sounds (the orbit is about to sink). */
export function Hint() {
  const warning = useHud((s) => s.warning && s.status === 'playing')
  const canHold = useHud((s) => s.canHold)
  const globeBottom = useView((s) => s.globeBottom)
  const padReserve = useView((s) => s.padReserve)
  const touch = useView((s) => s.touchTop !== null)
  if (!warning) return null
  // the free strip is between the glow of the globe and the top of the arrow pad (the bottom edge when there is no pad)
  const keysTop = touch ? `calc(100% - ${padReserve}px)` : '100%'
  return (
    <div className="hint" style={{ top: `calc((${globeBottom}px + ${keysTop}) / 2)` }}>
      {canHold ? `press ${touch ? '▲' : '↑'} to hold the orbit` : 'no fuel to hold the orbit'}
    </div>
  )
}
