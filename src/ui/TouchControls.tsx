import { useEffect, useState } from 'react'
import { startAudio } from '../audio/audio'
import { steer, toggleFullscreen, type Steer } from '../input'
import { useSettings } from '../state/settings'
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
  if (!touch) return null
  return (
    <div className="touch" onContextMenu={(e) => e.preventDefault()}>
      <div className="touch-top">
        <button type="button" className="touch-small" aria-label="Layers panel" onClick={togglePanel}>☰</button>
        <button type="button" className="touch-small" aria-label={sound ? 'Sound off' : 'Sound on'} onClick={() => setAllSound(!sound)}>
          {sound ? '🔊' : '🔇'}
        </button>
        <button type="button" className="touch-small" aria-label="Fullscreen" onClick={toggleFullscreen}>⛶</button>
      </div>
      <div className="touch-group touch-turn" aria-label="Turn the orbit">
        <Pad kind="left" label="◀" title="Turn the orbit left" />
        <Pad kind="right" label="▶" title="Turn the orbit right" />
      </div>
      <div className="touch-group touch-alt" aria-label="Change the altitude">
        <Pad kind="up" label="▲" title="Raise the orbit" />
        <Pad kind="down" label="▼" title="Lower the orbit" />
      </div>
    </div>
  )
}
