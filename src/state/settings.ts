import { create } from 'zustand'
import { setAmbientEnabled, setSfxEnabled } from '../audio/audio'
import { nightLayer } from '../render/style'
import type { WeatherStatus } from './weatherLoader'
import { world } from './world'

/** The layers the player can switch on and off. */
export const LAYERS = [
  ['stars', 'Stars'],
  ['atmo', 'Atmosphere'],
  ['ocean', 'Ocean'],
  ['land', 'Continents'],
  ['terrain', 'Relief (mountains, sea depth)'],
  ['night', 'Day / night'],
  ['cities', 'City lights'],
  ['clouds', 'Clouds'],
  ['bloom', 'Glow (bloom)'],
  ['sats', 'Satellites'],
  ['iss', 'ISS'],
  ['game', 'Game (turtle, score)'],
] as const
export type LayerKey = (typeof LAYERS)[number][0]

export const GRAPHICS_NAMES = ['full', 'reduced', 'low', 'minimal'] as const

interface Settings {
  layers: Record<LayerKey, boolean>
  /** "Auto-reduce graphics" */
  autoQuality: boolean
  /** current graphics level, 0 = full ... 3 = minimal (only auto-quality lowers it) */
  quality: number
  panelVisible: boolean
  fps: number
  /** the background hum, and every other sound (both remembered between visits) */
  ambient: boolean
  sfx: boolean
  /** real cloud cover from Open-Meteo (remembered); off = the climate guess, and no network request at all */
  liveWeather: boolean
  setLiveWeather: (on: boolean) => void
  /** what the clouds are drawn from right now */
  weather: WeatherStatus
  setAmbient: (on: boolean) => void
  setSfx: (on: boolean) => void
  /** both at once: the M key and the touch button */
  setAllSound: (on: boolean) => void
  setLayer: (key: LayerKey, on: boolean) => void
  setAutoQuality: (on: boolean) => void
  togglePanel: () => void
}

const AMBIENT_KEY = 'deorbit.ambient'
const SFX_KEY = 'deorbit.sfx'
const WEATHER_KEY = 'deorbit.liveWeather'

function load(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'off'
  } catch {
    return true // storage can be blocked (private window): the default is simply on
  }
}

function save(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? 'on' : 'off')
  } catch {
    /* not remembered: fine */
  }
}

export const useSettings = create<Settings>((set) => ({
  layers: Object.fromEntries(LAYERS.map(([k]) => [k, true])) as Record<LayerKey, boolean>,
  autoQuality: true,
  quality: 0,
  panelVisible: typeof window === 'undefined' || window.innerWidth >= 720, // a phone starts with the panel hidden
  fps: 0,
  liveWeather: load(WEATHER_KEY),
  setLiveWeather: (on) => {
    save(WEATHER_KEY, on)
    set({ liveWeather: on })
  },
  weather: { source: 'climate', time: '' },
  ambient: load(AMBIENT_KEY),
  sfx: load(SFX_KEY),
  setAmbient: (on) => {
    save(AMBIENT_KEY, on)
    set({ ambient: on })
  },
  setSfx: (on) => {
    save(SFX_KEY, on)
    set({ sfx: on })
  },
  setAllSound: (on) => {
    save(AMBIENT_KEY, on)
    save(SFX_KEY, on)
    set({ ambient: on, sfx: on })
  },
  setLayer: (key, on) => set((s) => ({ layers: { ...s.layers, [key]: on } })),
  setAutoQuality: (on) => set({ autoQuality: on, ...(on ? {} : { quality: 0 }) }), // switched off = full graphics again
  togglePanel: () => set((s) => ({ panelVisible: !s.panelVisible })),
}))

/** The three layers that change the RULES live in the simulation: keep them in sync. */
function syncRules(layers: Record<LayerKey, boolean>): void {
  world.game.layers.game = layers.game
  world.game.layers.iss = layers.iss
  world.game.layers.sats = layers.sats
}
function sync(layers: Record<LayerKey, boolean>): void {
  syncRules(layers)
  nightLayer.on = layers.night
}
sync(useSettings.getState().layers)
useSettings.subscribe((s) => sync(s.layers))

let sound = { ambient: useSettings.getState().ambient, sfx: useSettings.getState().sfx }
setAmbientEnabled(sound.ambient)
setSfxEnabled(sound.sfx)
useSettings.subscribe((s) => {
  // the store changes twice a second (the FPS counter): only react to a real change of a sound switch
  if (s.ambient !== sound.ambient) setAmbientEnabled(s.ambient)
  if (s.sfx !== sound.sfx) setSfxEnabled(s.sfx)
  sound = { ambient: s.ambient, sfx: s.sfx }
})
