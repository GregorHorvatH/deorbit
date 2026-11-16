/** Keyboard: one press is one step (15 degrees / one altitude level). Holding a key does nothing more: auto-repeat is
 *  ignored, so a value never runs away from you. */
import { play, startAudio } from './audio/audio'
import { endPending, steerPlayer, type SteerKind } from './sim'
import { useSettings } from './state/settings'
import { startNewGame, togglePause, world } from './state/world'

export type Steer = SteerKind

/** One step of steering (a key press or a tap on a touch button): turn the orbit 15 degrees / change the altitude one level. */
export function steer(kind: Steer): void {
  if (!steerPlayer(world.game, kind)) return // paused, out of fuel, or already at the limit: nothing happens
  play(kind === 'left' ? 'puffL' : kind === 'right' ? 'puffR' : kind === 'up' ? 'puffU' : 'puffD')
}

/** Enter / Space / R / P / Escape: start, pause, play again - whatever the current screen offers. */
export function screenKey(code: string): boolean {
  const g = world.game
  if (!g.layers.game || endPending(g)) return false // nothing to restart while the end is still playing out
  const go = code === 'Enter' || code === 'Space'
  if (g.status === 'ready' || g.status === 'won' || g.status === 'lost') {
    if (go || code === 'KeyR') startNewGame()
    else return false
  } else if (g.status === 'paused') {
    if (go || code === 'KeyP' || code === 'Escape') togglePause()
    else if (code === 'KeyR') startNewGame()
    else return false
  } else if (code === 'KeyP' || code === 'Escape') togglePause()
  else return false
  return true
}

const KEYS: Record<string, Steer> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }

export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen()
  else void document.documentElement.requestFullscreen?.()
}

/** Binds the shortcuts; returns the function that unbinds them. */
export function bindInput(): () => void {
  const held = new Set<string>()
  const down = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    startAudio() // the first key press unlocks the sound
    const kind = KEYS[e.code]
    if (!e.repeat && screenKey(e.code)) {
      e.preventDefault()
    } else if (kind) {
      e.preventDefault() // the arrows must not scroll the page
      if (e.repeat || held.has(e.code)) return // auto-repeat of a held key
      held.add(e.code)
      steer(kind)
    } else if ((e.code === 'KeyF' || e.code === 'F11') && !e.repeat) {
      e.preventDefault()
      toggleFullscreen()
    } else if (e.code === 'KeyH' && !e.repeat) {
      useSettings.getState().togglePanel()
    } else if (e.code === 'KeyM' && !e.repeat) {
      const st = useSettings.getState()
      st.setAllSound(!(st.ambient || st.music || st.sfx)) // any sound on -> all off; all off -> all on
    }
  }
  const up = (e: KeyboardEvent): void => void held.delete(e.code)
  const clear = (): void => held.clear() // never leave a key "stuck" when the window loses focus
  window.addEventListener('keydown', down)
  window.addEventListener('pointerdown', startAudio) // a tap or a click unlocks the sound too
  window.addEventListener('keyup', up)
  window.addEventListener('blur', clear)
  document.addEventListener('visibilitychange', clear)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('pointerdown', startAudio)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', clear)
    document.removeEventListener('visibilitychange', clear)
  }
}
