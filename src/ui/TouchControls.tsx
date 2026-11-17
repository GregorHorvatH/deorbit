import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { startAudio } from '../audio/audio'
import { steer, toggleFullscreen, type Steer } from '../input'
import { useHud, useView } from '../state/hud'
import { useSettings } from '../state/settings'
import { togglePause } from '../state/world'
import './touch.css'

/** A touch screen (or ?touch=1 for testing). A hybrid laptop starts without them and gets them on the first touch. */
function detectTouch(): boolean {
  if (typeof window === 'undefined') return false
  if (new URLSearchParams(window.location.search).has('touch')) return true
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

function Pad({ kind, label, title }: { kind: Steer; label: string; title: string }) {
  return (
    <button
      type="button"
      className={`touch-btn touch-${kind}`}
      aria-label={title}
      // pointerdown, not click: no 300 ms delay, and every tap is exactly one step (a held finger repeats nothing)
      onPointerDown={(e) => {
        e.preventDefault()
        startAudio()
        steer(kind)
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  )
}

/** On-screen buttons: the same four one-step controls as the arrow keys, plus the things a phone has no key for. */
export function TouchControls() {
  const [touch, setTouch] = useState(detectTouch)
  useEffect(() => {
    if (touch) return
    const on = (): void => setTouch(true)
    window.addEventListener('touchstart', on, { once: true, passive: true })
    return () => window.removeEventListener('touchstart', on)
  }, [touch])
  const sound = useSettings((s) => s.ambient || s.music || s.sfx)
  const { setAllSound, togglePanel } = useSettings.getState()
  const status = useHud((s) => s.status)
  const top = useRef<HTMLDivElement>(null)
  const pad = useRef<HTMLDivElement>(null)
  // The instruments start right under the row of buttons and the globe keeps clear of the arrow pad: measure both
  // (the phone's notch and the browser's bars make the real positions differ from the CSS numbers).
  useLayoutEffect(() => {
    if (!touch) {
      useView.setState({ touchTop: null, padReserve: 0 })
      return
    }
    const measure = (): void => {
      const row = top.current?.getBoundingClientRect()
      const keys = pad.current?.getBoundingClientRect()
      useView.setState({
        touchTop: row ? Math.ceil(row.bottom + 8) : null,
        padReserve: keys ? Math.max(0, Math.ceil(window.innerHeight - keys.top + 8)) : 0,
      })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [touch])
  if (!touch) return null
  return (
    <div className="touch" onContextMenu={(e) => e.preventDefault()}>
      <div className="touch-top" ref={top}>
        <button type="button" className="touch-small" aria-label="Layers panel" onClick={togglePanel}>☰</button>
        <button type="button" className="touch-small" aria-label={sound ? 'Sound off' : 'Sound on'} onClick={() => setAllSound(!sound)}>
          {sound ? '🔊' : '🔇'}
        </button>
        {(status === 'playing' || status === 'paused') && (
          <button type="button" className="touch-small" aria-label={status === 'paused' ? 'Resume' : 'Pause'} onClick={togglePause}>
            {status === 'paused' ? '▶' : '⏸'}
          </button>
        )}
        <button type="button" className="touch-small" aria-label="Fullscreen" onClick={toggleFullscreen}>⛶</button>
      </div>
      <div className="touch-dpad" ref={pad} aria-label="Steer the turtle">
        <Pad kind="up" label="▲" title="Raise the orbit" />
        <Pad kind="left" label="◀" title="Turn the orbit left" />
        <Pad kind="right" label="▶" title="Turn the orbit right" />
        <Pad kind="down" label="▼" title="Lower the orbit" />
      </div>
    </div>
  )
}
