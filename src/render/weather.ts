/** Real cloud cover from Open-Meteo (https://open-meteo.com, CC BY 4.0): the pure parts - which points to ask for, how
 *  to read the answer, and how to turn the answer into the weather map the cloud shader uses. Nothing here touches the
 *  network. The request carries only a fixed grid of the Earth's points: nothing about the player. */
import { COVERAGE_H, COVERAGE_W } from './coverage'

export const GRID_STEP = 15 // degrees
export const GRID_LONS = 360 / GRID_STEP // 24
export const GRID_LATS = 180 / GRID_STEP // 12
export const GRID_POINTS = GRID_LONS * GRID_LATS // 288: one request, and 288 "calls" of the free allowance (10 000 a day)

/** The centres of the grid cells: row-major, south to north, west to east. */
export function gridPoints(): Array<[number, number]> {
  const pts: Array<[number, number]> = []
  for (let j = 0; j < GRID_LATS; j++) {
    for (let i = 0; i < GRID_LONS; i++) pts.push([-90 + GRID_STEP * (j + 0.5), -180 + GRID_STEP * (i + 0.5)])
  }
  return pts
}

export function buildUrl(): string {
  const pts = gridPoints()
  return (
    'https://api.open-meteo.com/v1/forecast?latitude=' + pts.map((p) => p[0]).join(',') +
    '&longitude=' + pts.map((p) => p[1]).join(',') + '&current=cloud_cover&timezone=GMT'
  )
}

export interface Weather {
  /** cloud cover in percent, in the order of gridPoints() */
  values: number[]
  /** when the data is from, as Open-Meteo gives it (GMT) */
  time: string
}

/** Reads the answer; null when it is not what we asked for (so a broken answer is never shown as weather). */
export function parseResponse(json: unknown): Weather | null {
  if (!Array.isArray(json) || json.length !== GRID_POINTS) return null
  const values: number[] = []
  for (const item of json) {
    const v = (item as { current?: { cloud_cover?: unknown } } | null)?.current?.cloud_cover
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) return null
    values.push(v)
  }
  const time = (json[0] as { current?: { time?: unknown } }).current?.time
  return { values, time: typeof time === 'string' ? time : '' }
}

/** The weather map (cloud fraction 0..255 on a 5 degree grid, row 0 = the south pole) from the 15 degree grid: bilinear,
 *  wrapping around in longitude, held constant beyond the last row at each pole. */
export function coverageFromGrid(values: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(COVERAGE_W * COVERAGE_H)
  for (let y = 0; y < COVERAGE_H; y++) {
    const lat = -90 + ((y + 0.5) * 180) / COVERAGE_H
    const v = Math.max(0, Math.min(GRID_LATS - 1, (lat + 90) / GRID_STEP - 0.5))
    const j0 = Math.floor(v)
    const j1 = Math.min(GRID_LATS - 1, j0 + 1)
    const fv = v - j0
    for (let x = 0; x < COVERAGE_W; x++) {
      const lon = -180 + ((x + 0.5) * 360) / COVERAGE_W
      const u = (lon + 180) / GRID_STEP - 0.5
      const i0 = Math.floor(u)
      const fu = u - i0
      const a = ((i0 % GRID_LONS) + GRID_LONS) % GRID_LONS
      const b = (a + 1) % GRID_LONS
      const at = (j: number, i: number): number => values[j * GRID_LONS + i]
      const lo = at(j0, a) * (1 - fu) + at(j0, b) * fu
      const hi = at(j1, a) * (1 - fu) + at(j1, b) * fu
      out[y * COVERAGE_W + x] = Math.round(((lo * (1 - fv) + hi * fv) / 100) * 255)
    }
  }
  return out
}
