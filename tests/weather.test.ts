import { describe, expect, test } from 'vitest'
import { analyticCoverage, COVERAGE_H, COVERAGE_W, CoverageBlender } from '../src/render/coverage'
import { buildUrl, coverageFromGrid, GRID_LONS, GRID_POINTS, gridPoints, parseResponse } from '../src/render/weather'
import { type Deps, loadCache, REFRESH_MS, RETRY_MS, startWeather, type WeatherStatus } from '../src/state/weatherLoader'

const answer = (value: (i: number) => number = () => 50): unknown =>
  gridPoints().map(([la, lo], i) => ({ latitude: la, longitude: lo, current: { time: '2026-11-16T12:15', cloud_cover: value(i) } }))

describe('the request', () => {
  test('288 points, south to north and west to east, in one URL a server will accept', () => {
    const pts = gridPoints()
    expect(pts.length).toBe(GRID_POINTS)
    expect(pts[0]).toEqual([-82.5, -172.5])
    expect(pts[GRID_LONS - 1]).toEqual([-82.5, 172.5])
    expect(pts[pts.length - 1]).toEqual([82.5, 172.5])
    const url = buildUrl()
    expect(url.startsWith('https://api.open-meteo.com/v1/forecast?')).toBe(true)
    expect(url.length).toBeLessThan(6000)
    expect(url).toContain('current=cloud_cover')
    // nothing about the player goes out: the URL is a fixed grid of the Earth's points
    expect(url).toBe(buildUrl())
  })
})

describe('reading the answer', () => {
  test('a good answer', () => {
    const w = parseResponse(answer((i) => i % 101))!
    expect(w.values.length).toBe(GRID_POINTS)
    expect(w.time).toBe('2026-11-16T12:15')
  })
  test('anything else is refused, never shown as weather', () => {
    expect(parseResponse(null)).toBeNull()
    expect(parseResponse({ error: true, reason: 'daily limit' })).toBeNull()
    expect(parseResponse((answer() as unknown[]).slice(1))).toBeNull() // too few places
    expect(parseResponse(answer((i) => (i === 7 ? 140 : 50)))).toBeNull() // not a percentage
    expect(parseResponse(answer((i) => (i === 7 ? NaN : 50)))).toBeNull()
  })
})

describe('the weather map from the grid', () => {
  test('a uniform sky stays uniform, and 100% is full cloud', () => {
    expect(new Set(coverageFromGrid(new Array(GRID_POINTS).fill(100)))).toEqual(new Set([255]))
    expect(new Set(coverageFromGrid(new Array(GRID_POINTS).fill(0)))).toEqual(new Set([0]))
  })
  test('one cloudy cell lands in the right place on the map (row 0 = the south pole, column 0 = -180)', () => {
    const g = new Array(GRID_POINTS).fill(0)
    const j = 8, i = 14 // lat -90 + 15 * 8.5 = 37.5 N, lon -180 + 15 * 14.5 = 37.5 E
    g[j * GRID_LONS + i] = 100
    const m = coverageFromGrid(g)
    const at = (lat: number, lon: number): number => m[Math.floor((lat + 90) / (180 / COVERAGE_H)) * COVERAGE_W + Math.floor((lon + 180) / (360 / COVERAGE_W))]
    expect(at(37.5, 37.5)).toBeGreaterThan(200)
    expect(at(-37.5, 37.5)).toBe(0) // the mirror image in the south
    expect(at(37.5, -142.5)).toBe(0) // the other side of the world
  })
  test('longitude wraps around the date line', () => {
    const g = new Array(GRID_POINTS).fill(0)
    g[5 * GRID_LONS + GRID_LONS - 1] = 100 // the last column: lon 172.5
    const m = coverageFromGrid(g)
    const row = 16 // the map row whose centre (-7.5 degrees) is the centre of grid row 5
    expect(m[row * COVERAGE_W + 0]).toBeGreaterThan(0) // the first column (lon -177.5) feels it
    expect(m[row * COVERAGE_W + COVERAGE_W - 1]).toBeGreaterThan(m[row * COVERAGE_W + 0])
  })
})

describe('morphing to a new map', () => {
  const a = new Uint8Array(10).fill(0)
  const b = new Uint8Array(10).fill(200)
  test('starts where it was, passes through the middle, ends on the new map', () => {
    const m = new CoverageBlender(a)
    m.set(b, 40, 100)
    expect(m.data[0]).toBe(0)
    m.step(120)
    expect(m.data[0]).toBe(100) // half way, eased
    expect(m.step(140)).toBe(true)
    expect(m.data[0]).toBe(200)
    expect(m.moving).toBe(false)
    expect(m.step(200)).toBe(false) // nothing left to do
  })
  test('it never jumps: the steps between frames are small and in one direction', () => {
    const m = new CoverageBlender(a)
    m.set(b, 40, 0)
    let prev = m.data[0]
    for (let t = 0.1; t <= 40; t += 0.1) {
      m.step(t)
      expect(m.data[0] - prev).toBeGreaterThanOrEqual(0)
      expect(m.data[0] - prev).toBeLessThan(8)
      prev = m.data[0]
    }
  })
  test('a new target in the middle of a morph carries on from the current state (no snap back)', () => {
    const m = new CoverageBlender(a)
    m.set(b, 40, 0)
    m.step(20)
    const mid = m.data[0]
    m.set(a, 40, 20)
    expect(m.data[0]).toBe(mid)
    m.step(40)
    expect(m.data[0]).toBeLessThan(mid)
  })
  test('zero seconds is an instant change', () => {
    const m = new CoverageBlender(a)
    m.set(b, 0, 5)
    expect(m.data[3]).toBe(200)
  })
  test('the default map has the shape of the real one', () => {
    expect(analyticCoverage().length).toBe(COVERAGE_W * COVERAGE_H)
  })
})

describe('the schedule', () => {
  /** A fake world: a clock, a store, timers you fire by hand, and a network that answers as told. */
  function world(opts: { hidden?: boolean } = {}) {
    const w = {
      now: 1_000_000, hidden: opts.hidden ?? false, fetches: 0, mode: 'ok' as 'ok' | 'fail' | 'junk',
      store: new Map<string, string>(), timers: [] as Array<{ fn: () => void; ms: number; cleared: boolean }>,
      maps: [] as Array<Uint8Array | null>, statuses: [] as WeatherStatus[],
    }
    const deps: Deps = {
      fetchJson: async () => {
        w.fetches++
        if (w.mode === 'fail') throw new Error('offline')
        return w.mode === 'junk' ? { reason: 'limit' } : answer()
      },
      storage: { getItem: (k) => w.store.get(k) ?? null, setItem: (k, v) => void w.store.set(k, v) },
      now: () => w.now,
      setTimer: (fn, ms) => { const t = { fn, ms, cleared: false }; w.timers.push(t); return t },
      clearTimer: (id) => { (id as { cleared: boolean }).cleared = true },
      isHidden: () => w.hidden,
      onMap: (m) => w.maps.push(m),
      onStatus: (s) => w.statuses.push(s),
    }
    const pending = () => w.timers.filter((t) => !t.cleared)
    return { w, deps, pending }
  }
  const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

  test('first visit: one request, the weather is shown and remembered, the next one is an hour away', async () => {
    const { w, deps, pending } = world()
    const stop = startWeather(deps)
    await settle()
    expect(w.fetches).toBe(1)
    expect(w.maps.length).toBe(1)
    expect(w.statuses.at(-1)).toEqual({ source: 'live', time: '2026-11-16T12:15' })
    expect(loadCache(deps.storage)?.fetchedAt).toBe(w.now)
    expect(pending().map((t) => t.ms)).toEqual([REFRESH_MS])
    stop()
  })

  test('a reload within the hour costs no request: the remembered weather is shown at once', async () => {
    const { w, deps, pending } = world()
    const first = startWeather(deps)
    await settle() // let the first request finish before the tab is closed
    first()
    w.now += 20 * 60 * 1000
    const again = startWeather(deps)
    await settle()
    expect(w.fetches).toBe(1) // still only the first one
    expect(w.maps.length).toBe(2)
    expect(pending().at(-1)!.ms).toBe(REFRESH_MS - 20 * 60 * 1000) // the next one is due when the old one turns an hour
    again()
  })

  test('when the hour is up it asks again, and only then', async () => {
    const { w, deps, pending } = world()
    startWeather(deps)
    await settle()
    w.now += REFRESH_MS
    pending()[0].fn()
    await settle()
    expect(w.fetches).toBe(2)
  })

  test('offline: the climate guess, and a retry in ten minutes - never a loop', async () => {
    const { w, deps, pending } = world()
    w.mode = 'fail'
    startWeather(deps)
    await settle()
    expect(w.fetches).toBe(1)
    expect(w.maps).toEqual([null])
    expect(w.statuses.at(-1)).toEqual({ source: 'climate', time: '', failed: true })
    expect(pending().map((t) => t.ms)).toEqual([RETRY_MS])
    await settle()
    expect(w.fetches).toBe(1) // nothing hammers the server
  })

  test('a broken answer (a rate limit, say) is treated like being offline', async () => {
    const { w, deps, pending } = world()
    w.mode = 'junk'
    startWeather(deps)
    await settle()
    expect(w.maps).toEqual([null])
    expect(pending().map((t) => t.ms)).toEqual([RETRY_MS])
  })

  test('a failed refresh keeps the weather that is already on screen', async () => {
    const { w, deps, pending } = world()
    startWeather(deps)
    await settle()
    w.mode = 'fail'
    w.now += REFRESH_MS
    pending()[0].fn()
    await settle()
    expect(w.maps.length).toBe(1) // not reset to the climate guess
    expect(w.statuses.at(-1)?.source).toBe('live')
  })

  test('a hidden tab asks for nothing', async () => {
    const { w, deps } = world({ hidden: true })
    startWeather(deps)
    await settle()
    expect(w.fetches).toBe(0)
  })

  test('stopping cancels the next request', async () => {
    const { w, deps, pending } = world()
    const stop = startWeather(deps)
    await settle()
    stop()
    expect(pending().length).toBe(0)
    expect(w.fetches).toBe(1)
  })
})
