/** Geometry on the flat lon/lat map: point-in-polygon with a bounding-box shortcut, and the distance to a coast.
 *  Pure functions on the generated data (no canvas), so they run in the tests too. */
import { DESERTS } from './data/deserts'
import { LAKES } from './data/lakes'
import { LAND } from './data/land'

type Rings = ReadonlyArray<ReadonlyArray<number>>
interface Shape {
  rings: Rings
  minLon: number
  maxLon: number
  minLat: number
  maxLat: number
}

const boxed = (list: ReadonlyArray<Rings>): Shape[] =>
  list.map((rings) => {
    const o = rings[0]
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
    for (let i = 0; i < o.length; i += 2) {
      minLon = Math.min(minLon, o[i]); maxLon = Math.max(maxLon, o[i])
      minLat = Math.min(minLat, o[i + 1]); maxLat = Math.max(maxLat, o[i + 1])
    }
    return { rings, minLon, maxLon, minLat, maxLat }
  })

const LAND_SHAPES = boxed(LAND)
const LAKE_SHAPES = boxed(LAKES)
const DESERT_SHAPES = boxed(DESERTS.map((d) => [d]))

/** Whether the point (degrees) is in a desert. */
export function inDesert(lat: number, lon: number): boolean {
  return DESERT_SHAPES.some((s) => inside(s, lat, lon))
}

/** Even-odd test over all the rings of one polygon (the outline and its holes). */
function inside(s: Shape, lat: number, lon: number): boolean {
  if (lon < s.minLon || lon > s.maxLon || lat < s.minLat || lat > s.maxLat) return false
  let in_ = false
  for (const r of s.rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1]
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) in_ = !in_
    }
  }
  return in_
}

/** Whether the point (degrees) is dry land: inside the land and not inside a lake. */
export function inLand(lat: number, lon: number): boolean {
  if (!LAND_SHAPES.some((s) => inside(s, lat, lon))) return false
  return !LAKE_SHAPES.some((s) => inside(s, lat, lon))
}

/** Distance (degrees, a flat approximation) from a point to the nearest coast line of the land outlines. */
export function distToCoast(lat: number, lon: number): number {
  const k = Math.cos((lat * Math.PI) / 180)
  let best = Infinity
  for (const s of LAND_SHAPES) {
    if (lon < s.minLon - 10 || lon > s.maxLon + 10 || lat < s.minLat - 10 || lat > s.maxLat + 10) continue
    for (const r of s.rings) {
      for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
        const dx = (r[i] - r[j]) * k
        const dy = r[i + 1] - r[j + 1]
        const len2 = dx * dx + dy * dy
        const t = len2 > 0 ? Math.max(0, Math.min(1, (((lon - r[j]) * k) * dx + (lat - r[j + 1]) * dy) / len2)) : 0
        best = Math.min(best, Math.hypot((lon - r[j]) * k - t * dx, lat - r[j + 1] - t * dy))
      }
    }
  }
  return best
}

export { LAND_SHAPES, LAKE_SHAPES }
