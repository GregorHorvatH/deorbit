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
const MUSIC_VOLUME = 0.4
const MUSIC_FADE_MS = 4000

/** A looping sound that must exist at most ONCE (Howler starts a new instance on every play() without an id). */
interface Loop {
  howl: Howl | null
  id: number | null
  wanted: boolean
  volume: number
  fadeMs: number
}
const loop = (volume: number, fadeMs = 0): Loop => ({ howl: null, id: null, wanted: true, volume, fadeMs })

const state = {
  started: false,
  /** every other sound: steering ticks, catches, hits, burns */
  sfxOn: true,
  sounds: new Map<SoundName, Howl>(),
  /** the background hum and the music */
  ambient: loop(AMBIENT_VOLUME),
  music: loop(MUSIC_VOLUME, MUSIC_FADE_MS),
}

const instances = (l: Loop): number => {
  const sounds = (l.howl as unknown as { _sounds?: Array<{ _paused: boolean; _ended: boolean }> } | null)?._sounds ?? []
  return sounds.filter((x) => !x._paused && !x._ended).length
}

/** What has been played (for the tests and the dev console). */
export const audioStats = {
  started: false,
  played: {} as Partial<Record<SoundName, number>>,
  /** whether the background hum / the music is playing right now */
  get ambientPlaying(): boolean {
    return state.ambient.howl?.playing() ?? false
  },
  get musicPlaying(): boolean {
    return state.music.howl?.playing() ?? false
  },
  /** how many copies are sounding (must never be more than one) */
  get ambientInstances(): number {
    return instances(state.ambient)
  },
  get musicInstances(): number {
    return instances(state.music)
  },
}

const toHowl = (samples: Float32Array, opts: Partial<HowlOptions> = {}): Howl =>
  new Howl({
    src: [URL.createObjectURL(new Blob([synth.encodeWav(samples) as BlobPart], { type: 'audio/wav' }))],
    format: ['wav'],
    ...opts,
  })

/** Call from a user gesture (a key press or a tap): builds the sounds and starts the background hum and the music.
 *  Safe to call often. The music (half a second of number crunching) is built a moment later, so the first key is not delayed. */
export function startAudio(): void {
  if (state.started) return
  state.started = audioStats.started = true
  Howler.volume(0.8)
  for (const name of Object.keys(SOURCES) as SoundName[]) {
    state.sounds.set(name, toHowl(SOURCES[name](), { volume: VOLUME[name] ?? 1 }))
  }
  state.ambient.howl = toHowl(synth.drone(), { loop: true, volume: AMBIENT_VOLUME })
  syncLoops()
  document.addEventListener('visibilitychange', syncLoops) // a hidden tab is silent; it comes back with the tab
  setTimeout(() => {
    state.music.howl = toHowl(synth.music(), { loop: true, volume: MUSIC_VOLUME })
    syncLoops()
  }, 50)
}

/** Makes every loop match the wish: it sounds when wanted and the tab is visible, and is completely stopped otherwise.
 *  Idempotent: safe to call as often as you like, it never starts a second copy. The music fades in. */
function syncLoops(): void {
  for (const l of [state.ambient, state.music]) {
    const howl = l.howl
    if (!howl) continue
    if (l.wanted && !document.hidden) {
      if (l.id === null) {
        l.id = howl.play()
        if (l.fadeMs) howl.fade(0, l.volume, l.fadeMs, l.id)
      } else if (!howl.playing(l.id)) {
        howl.play(l.id)
      }
    } else if (l.id !== null) {
      howl.stop() // every copy, not a pause: it must be silent
      l.id = null
    }
  }
}

/** The background hum on / off. */
export function setAmbientEnabled(on: boolean): void {
  state.ambient.wanted = on
  syncLoops()
}

/** The music on / off. */
export function setMusicEnabled(on: boolean): void {
  state.music.wanted = on
  syncLoops()
}

/** Every other sound (not the hum, not the music) on / off. */
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
