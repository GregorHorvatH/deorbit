import { useEffect, useRef } from 'react'
import { startAudio } from '../audio/audio'
import { clock, useBest } from '../state/best'
import { useHud } from '../state/hud'
import { useSettings } from '../state/settings'
import { startNewGame, togglePause } from '../state/world'
import './screens.css'

const REASONS = {
  hull: 'Your hull was destroyed by a satellite.',
  reentry: 'Air drag pulled you down: you burnt up in the atmosphere.',
} as const

/** The title screen, the pause and the two end screens: a card over the live picture. Enter / Space / R / P / Esc work too. */
export function Screens() {
  const h = useHud()
  const game = useSettings((s) => s.layers.game)
  const best = useBest()
  const ended = h.status === 'won' || h.status === 'lost'
  const recorded = useRef(false)
  useEffect(() => {
    if (!ended) {
      recorded.current = false
    } else if (!recorded.current) {
      recorded.current = true
      useBest.getState().record(h.score, h.elapsed, h.status === 'won')
    }
  }, [ended, h.status, h.score, h.elapsed])
  if (!game || h.status === 'playing' || h.ending) return null // the end card waits until the fire is out, plus a second
  const act = (fn: () => void) => (e: React.SyntheticEvent): void => {
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.blur() // Enter / Space must not press the button a second time
    startAudio()
    fn()
  }
  const bestLine =
    best.score > 0 || best.time !== null
      ? `Best: ${best.score} caught${best.time !== null ? ` · fastest win ${clock(best.time)}` : ''}`
      : ''

  if (h.status === 'paused') {
    return (
      <div className="screen">
        <div className="card">
          <h1>Paused</h1>
          <p className="dim">The game is stopped. Nothing moves.</p>
          <div className="actions">
            <button type="button" onClick={act(togglePause)}>Resume <kbd>P</kbd></button>
            <button type="button" className="quiet" onClick={act(startNewGame)}>Restart <kbd>R</kbd></button>
          </div>
        </div>
      </div>
    )
  }

  if (ended) {
    const won = h.status === 'won'
    return (
      <div className="screen">
        <div className={`card ${won ? 'win' : 'loss'}`}>
          <h1>{won ? 'Mission complete' : 'Turtle lost'}</h1>
          <p>
            {won
              ? `You caught the fastest ISS: it flew at 95% of your speed (level ${h.finalLevel}).`
              : h.lostReason
                ? REASONS[h.lostReason]
                : ''}
          </p>
          <dl className="result">
            <div><dt>ISS caught</dt><dd>{h.score}</dd></div>
            <div><dt>Level</dt><dd>{Math.min(h.level, h.finalLevel)}</dd></div>
            <div><dt>Time</dt><dd>{clock(h.elapsed)}</dd></div>
          </dl>
          {best.fresh && <p className="record">New record!</p>}
          {bestLine && <p className="dim">{bestLine}</p>}
          <div className="actions">
            <button type="button" onClick={act(startNewGame)}>Play again <kbd>Enter</kbd></button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="card title">
        <h1>DEORBIT</h1>
        <p>
          You are a turtle on a satellite orbit. Catch the ISS {h.finalLevel} times: every catch makes it faster, adds a
          satellite and refuels you. The last one flies at 95% of your speed.
        </p>
        <ul>
          <li><b>Hull <span className="pink">♥♥♥</span>.</b> A satellite hit costs one. A <span className="pink">heart</span> that appears when you are hurt gives one back.</li>
          <li><b>Fuel.</b> Every key press burns some (climbing the most). No fuel, no steering. A caught ISS, or a <span className="amber">barrel</span> that appears when the tank runs low, refuels you.</li>
          <li><b>Air drag.</b> Every {Math.round(h.decayIn)} s your orbit sinks one level; below the lowest one you burn up. An alarm sounds 3 s before: press <kbd>↑</kbd> then to hold your altitude.</li>
        </ul>
        <p className="keys">
          <kbd>←</kbd> <kbd>→</kbd> turn the orbit &nbsp; <kbd>↑</kbd> <kbd>↓</kbd> raise / lower it &nbsp; <kbd>P</kbd> pause
        </p>
        <div className="actions">
          <button type="button" className="go" onClick={act(startNewGame)}>Start <kbd>Enter</kbd></button>
        </div>
        {bestLine && <p className="dim">{bestLine}</p>}
      </div>
    </div>
  )
}
