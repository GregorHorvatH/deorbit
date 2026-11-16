/** Fetches the cloud cover now and then, keeps the last answer in the browser, and falls back to the climate guess.
 *  The network, the clock, the storage and the timers are passed in, so the whole schedule is testable. */
import { buildUrl, coverageFromGrid, parseResponse, type Weather } from '../render/weather'

/** How often to ask. The data changes every 15-60 minutes, and one request costs 288 of the 10 000 free calls a day:
 *  once an hour (about 7 000 a day for a tab left open all day, and a reload within the hour costs nothing). */
export const REFRESH_MS = 60 * 60 * 1000
/** After a failure: try again later, never in a loop. */
export const RETRY_MS = 10 * 60 * 1000
export const TIMEOUT_MS = 20 * 1000
const CACHE_KEY = 'deorbit.weather'

export interface StoredWeather extends Weather {
  /** when it was fetched (ms since the epoch) */
  fetchedAt: number
}

export interface WeatherStatus {
  source: 'climate' | 'live'
  /** the time of the data (GMT), for the panel */
  time: string
  /** the last attempt to get real weather failed (offline, a rate limit...): it is tried again later */
  failed?: boolean
}

export interface Deps {
  fetchJson: (url: string, timeoutMs: number) => Promise<unknown>
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
  now: () => number
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (id: unknown) => void
  isHidden: () => boolean
  /** called with the new weather map, and with null to go back to the climate guess */
  onMap: (map: Uint8Array | null) => void
  onStatus: (s: WeatherStatus) => void
}

export function loadCache(storage: Deps['storage']): StoredWeather | null {
  try {
    const raw = storage?.getItem(CACHE_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as StoredWeather
    return typeof d.fetchedAt === 'number' && parseResponseValues(d.values) ? d : null
  } catch {
    return null
  }
}

const parseResponseValues = (v: unknown): v is number[] => Array.isArray(v) && v.length === 288 && v.every((x) => typeof x === 'number' && x >= 0 && x <= 100)

function saveCache(storage: Deps['storage'], w: StoredWeather): void {
  try {
    storage?.setItem(CACHE_KEY, JSON.stringify(w))
  } catch {
    /* a full or blocked storage: the weather is just not remembered */
  }
}

/** Starts the schedule; returns the function that stops it. */
export function startWeather(d: Deps): () => void {
  let timer: unknown = null
  let stopped = false
  let shown = false // has real weather been shown yet?

  const show = (w: Weather): void => {
    shown = true
    d.onMap(coverageFromGrid(w.values))
    d.onStatus({ source: 'live', time: w.time })
  }
  const later = (ms: number): void => {
    if (!stopped) timer = d.setTimer(run, ms)
  }

  async function run(): Promise<void> {
    if (stopped) return
    timer = null
    if (d.isHidden()) {
      // a hidden tab asks for nothing: it asks again as soon as it is visible (see visibility below)
      return
    }
    const cached = loadCache(d.storage)
    if (cached && !shown) show(cached)
    const age = cached ? d.now() - cached.fetchedAt : Infinity
    if (age < REFRESH_MS) return later(REFRESH_MS - age) // fresh enough: nothing to fetch
    try {
      const w = parseResponse(await d.fetchJson(buildUrl(), TIMEOUT_MS))
      if (stopped) return
      if (!w) throw new Error('unexpected answer')
      saveCache(d.storage, { ...w, fetchedAt: d.now() })
      show(w)
      later(REFRESH_MS)
    } catch {
      if (stopped) return
      if (!shown) {
        d.onMap(null)
        d.onStatus({ source: 'climate', time: '', failed: true })
      }
      later(RETRY_MS)
    }
  }

  const onVisible = (): void => {
    if (!stopped && timer === null && !d.isHidden()) void run()
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
  void run()
  return () => {
    stopped = true
    if (timer !== null) d.clearTimer(timer)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
  }
}

/** At most ONE request in flight, however many times the schedule is started (React runs an effect twice in development,
 *  and every request costs 288 of the free allowance). */
let inflight: Promise<unknown> | null = null

/** The real dependencies. */
export function realDeps(onMap: Deps['onMap'], onStatus: Deps['onStatus']): Deps {
  let storage: Deps['storage'] = null
  try {
    storage = localStorage
  } catch {
    /* blocked */
  }
  return {
    fetchJson: (url, timeoutMs) => {
      inflight ??= (async () => {
        const ctl = new AbortController()
        const t = setTimeout(() => ctl.abort(), timeoutMs)
        try {
          const r = await fetch(url, { signal: ctl.signal })
          if (!r.ok) throw new Error('HTTP ' + r.status)
          return await r.json()
        } finally {
          clearTimeout(t)
        }
      })().finally(() => {
        inflight = null
      })
      return inflight
    },
    storage,
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    isHidden: () => document.hidden,
    onMap,
    onStatus,
  }
}
