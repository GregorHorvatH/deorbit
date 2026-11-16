/** Sound through Howler. The samples are synthesised in code (see synth.ts), so there are no audio assets to load.
 *  Nothing is created until the first user gesture (browsers keep audio locked until then anyway). */
import { Howl, Howler, type HowlOptions } from 'howler'
import type { GameEvent } from '../sim'
import * as synth from './synth'

export type SoundName = 'tickL' | 'tickR' | 'tickU' | 'tickD' | 'capture' | 'bump' | 'spawn' | 'burn' | 'pop'

const SOURCES: Record<SoundName, () => Float32Array> = {
  tickL: () => synth.tick(760),
  tickR: () => synth.tick(860),
  tickU: () => synth.tick(1040),
  tickD: () => synth.tick(560),
  capture: synth.capture,
  bump: synth.bump,
  spawn: synth.spawn,
  burn: synth.burn,
  pop: synth.pop,
}
const VOLUME: Partial<Record<SoundName, number>> = { burn: 0.8, tickL: 0.6, tickR: 0.6, tickU: 0.6, tickD: 0.6 }
const AMBIENT_VOLUME = 0.12

const state = {
  started: false,
  /** the background hum */
  ambientOn: true,
  /** every other sound: steering ticks, catches, hits, burns */
  sfxOn: true,
  sounds: new Map<SoundName, Howl>(),
  ambient: null as Howl | null,
  /** the ONE playing instance of the hum (Howler starts a new instance on every play() without an id) */
  ambientId: null as number | null,
}
/** What has been played (for the tests and the dev console). */
export const audioStats = {
  started: false,
  played: {} as Partial<Record<SoundName, number>>,
  /** whether the background hum is playing right now */
  get ambientPlaying(): boolean {
    return state.ambient?.playing() ?? false
  },
  /** how many copies of the hum are sounding (must never be more than one) */
  get ambientInstances(): number {
    const sounds = (state.ambient as unknown as { _sounds?: Array<{ _paused: boolean; _ended: boolean }> } | null)?._sounds ?? []
    return sounds.filter((x) => !x._paused && !x._ended).length
  },
}

const toHowl = (samples: Float32Array, opts: Partial<HowlOptions> = {}): Howl =>
  new Howl({
    src: [URL.createObjectURL(new Blob([synth.encodeWav(samples) as BlobPart], { type: 'audio/wav' }))],
    format: ['wav'],
    ...opts,
  })

/** Call from a user gesture (a key press or a tap): builds the sounds and starts the background hum. Safe to call often. */
export function startAudio(): void {
  if (state.started) return
  state.started = audioStats.started = true
  Howler.volume(0.8)
  for (const name of Object.keys(SOURCES) as SoundName[]) {
    state.sounds.set(name, toHowl(SOURCES[name](), { volume: VOLUME[name] ?? 1 }))
  }
  state.ambient = toHowl(synth.drone(), { loop: true, volume: AMBIENT_VOLUME })
  syncAmbient()
  document.addEventListener('visibilitychange', syncAmbient) // a hidden tab is silent; it comes back with the tab
}

/** Makes the hum match the wish: it sounds when the background sound is on and the tab is visible, and is completely
 *  stopped otherwise. Idempotent: safe to call as often as you like, it never starts a second copy. */
function syncAmbient(): void {
  const hum = state.ambient
  if (!hum) return
  if (state.ambientOn && !document.hidden) {
    if (state.ambientId === null) state.ambientId = hum.play()
    else if (!hum.playing(state.ambientId)) hum.play(state.ambientId)
  } else if (state.ambientId !== null) {
    hum.stop() // every copy, not a pause: it must be silent
    state.ambientId = null
  }
}

/** The background hum on / off. */
export function setAmbientEnabled(on: boolean): void {
  state.ambientOn = on
  syncAmbient()
}

/** Every sound except the background hum on / off. */
export function setSfxEnabled(on: boolean): void {
  state.sfxOn = on
}

export function play(name: SoundName): void {
  if (!state.sfxOn || !state.started) return
  state.sounds.get(name)?.play()
  audioStats.played[name] = (audioStats.played[name] ?? 0) + 1
}

/** The simulation's events -> sounds. A catch is also the start of the burn. */
export function playEvents(events: readonly GameEvent[]): void {
  for (const e of events) {
    if (e === 'capture') {
      play('capture')
      play('burn')
    } else if (e === 'bump') play('bump')
    else if (e === 'spawn') play('spawn')
    else if (e === 'burnout') play('pop')
  }
}

if (import.meta.env.DEV) (window as unknown as { __audio: typeof audioStats }).__audio = audioStats // for the browser tests
