/** City lights: a bright core plus a few smaller lights around every city, only where the map
 *  has land. Positions are unit vectors in the globe's own frame (they turn with it). */
import { mulberry32, type Rng } from '../sim'
import { CITIES } from '../sim/data/cities'
import { RIVERS } from './data/rivers'
import { LAKE_SHAPES, LAND_SHAPES, distToCoast, inDesert, inLand } from './geo'
import { CITY_DOTS, CITY_SPREAD, COAST_DEPTH, COAST_SPACING } from './style'

const MIN_COAST_AREA = 1.5 // square degrees: smaller islands and ponds get no coast lights
/** Rivers with towns all along them: at night they are lines of light (the Nile valley is the classic). */
const LIT_RIVERS = new Set(['Nile', 'Damietta Branch', 'Rosetta Branch', 'Ganges', 'Yangtze', 'Huang', 'Yellow', 'Mississippi', 'Ohio',
  'Danube', 'Indus', 'Mekong', 'Euphrates', 'Al Furat', 'Volga', 'St. Lawrence', 'Paraná'])
const RIVER_SPACING = 0.28 // degrees between candidate river lights
const DESERT_DIM = 0.3 // a coast in a desert is only a third as lit
const SMOOTH_EPS = 0.35 // degrees: how finely the coast is followed when placing lights

export interface CityLight {
  /** position on the unit sphere before the globe's rotation: (cos lat sin lon, sin lat, cos lat cos lon) */
  x: number
  y: number
  z: number
  /** half-size in design pixels */
  size: number
  /** the bright centre of a city (it also gets a soft glow) */
  core: boolean
  phase: number
}

/** Douglas-Peucker on a closed flat ring (degrees): keeps the shape of a coast but not its every fjord. */
function smoothRing(r: ReadonlyArray<number>, eps: number): Array<[number, number]> {
  const pts: Array<[number, number]> = []
  for (let i = 0; i < r.length; i += 2) pts.push([r[i], r[i + 1]])
  const keep = new Array<boolean>(pts.length).fill(false)
  keep[0] = keep[pts.length - 1] = true
  const stack: Array<[number, number]> = [[0, pts.length - 1]]
  while (stack.length) {
    const [i, j] = stack.pop()!
    let far = 0, fi = -1
    for (let k = i + 1; k < j; k++) {
      const [ax, ay] = pts[i], [bx, by] = pts[j], [px, py] = pts[k]
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy)
      if (d > far) { far = d; fi = k }
    }
    if (fi >= 0 && far > eps) { keep[fi] = true; stack.push([i, fi], [fi, j]) }
  }
  return pts.filter((_, k) => keep[k])
}

/** How populated a latitude is, 0..1: the temperate belts are full, the far north and south are nearly empty. */
const populated = (lat: number): number => Math.max(0.03, Math.min(1, (68 - Math.abs(lat)) / 20))

/** Signed area of a flat [lon, lat, ...] ring (positive = counter-clockwise). */
function signedArea(r: ReadonlyArray<number>): number {
  let a = 0
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) a += r[j] * r[i + 1] - r[i] * r[j + 1]
  return a / 2
}

/** Lights along the outline of every sizeable landmass and big lake shore, so a continent is recognisable on the dark
 *  side. They come in settlements and gaps (the density wanders along the coast) and sit a little inland, never on the
 *  sea. Polar land is left dark. The outline is walked by arc length, so the density does not depend on how finely the
 *  coast is drawn. */
export function makeCoastLights(rnd: Rng): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [] // [lat, lon, size]
  const rings: ReadonlyArray<number>[] = []
  for (const s of LAND_SHAPES) if (Math.abs(signedArea(s.rings[0])) > MIN_COAST_AREA) rings.push(s.rings[0])
  for (const s of LAKE_SHAPES) if (Math.abs(signedArea(s.rings[0])) > MIN_COAST_AREA) rings.push(s.rings[0])
  for (const r of rings) {
    let meanLat = 0
    for (let i = 1; i < r.length; i += 2) meanLat += r[i]
    meanLat /= r.length / 2
    if (meanLat < -60 || meanLat > 72) continue // Antarctica and the Arctic archipelago stay dark
    // the outline of land is counter-clockwise: inland is on the left; for the shore of a lake it is the other way round
    const lake = LAKE_SHAPES.some((s) => s.rings[0] === r)
    const side = (signedArea(r) > 0 ? 1 : -1) * (lake ? -1 : 1)
    // the settlement density wanders along the coast: a few slow waves, squared so there are real gaps
    const waves = [0, 1, 2].map((k) => ({ f: rnd.uniform(0.25, 0.9) * (k + 1) * 0.7, ph: rnd.uniform(0, 2 * Math.PI) }))
    let arc = 0
    let carry = rnd.uniform(0, COAST_SPACING) // distance to the next candidate
    const path = smoothRing(r, SMOOTH_EPS) // walk a smoothed coast: the density must not depend on how many fjords it has
    const n = path.length
    for (let i = 0; i < n; i++) {
      const j = (i + n - 1) % n
      const [x1, y1] = path[j]
      const [x2, y2] = path[i]
      const len = Math.hypot(x2 - x1, y2 - y1)
      if (len === 0 || (Math.abs(x1) > 179.9 && Math.abs(x2) > 179.9)) {
        arc += len
        continue
      }
      const nx = (-(y2 - y1) / len) * side
      const ny = ((x2 - x1) / len) * side
      let d = carry
      for (; d < len; d += COAST_SPACING) {
        const t = d / len
        const lat0 = y1 + (y2 - y1) * t
        const w = waves.reduce((a, { f, ph }) => a + Math.sin(f * (arc + d) + ph), 0) / 3 // -1..1
        const lon0 = x1 + (x2 - x1) * t
        const density = Math.max(0, 0.5 + 0.7 * w) ** 1.5 * populated(lat0) * (inDesert(lat0, lon0) ? DESERT_DIM : 1)
        if (rnd.uniform(0, 1) > density) continue
        const inland = rnd.uniform(0, 1) ** 2 * COAST_DEPTH // mostly right on the coast, a few further in
        const k = Math.max(0.3, Math.cos((lat0 * Math.PI) / 180))
        out.push([
          lat0 + ny * inland + rnd.gauss(0, 0.12),
          x1 + (x2 - x1) * t + (nx * inland) / k + rnd.gauss(0, 0.12) / k,
          rnd.uniform(0.6, 1),
        ])
      }
      carry = d - len
      arc += len
    }
  }
  return out
}

/** Lights along the big rivers that have towns all along them. */
export function makeRiverLights(rnd: Rng): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = []
  for (const river of RIVERS) {
    if (!LIT_RIVERS.has(river.name)) continue
    const p = river.pts
    const waves = [0, 1].map((k) => ({ f: rnd.uniform(0.4, 1.2) * (k + 1), ph: rnd.uniform(0, 2 * Math.PI) }))
    let arc = 0
    let carry = rnd.uniform(0, RIVER_SPACING)
    for (let i = 2; i < p.length; i += 2) {
      const x1 = p[i - 2], y1 = p[i - 1], x2 = p[i], y2 = p[i + 1]
      const len = Math.hypot(x2 - x1, y2 - y1)
      if (len === 0) continue
      let d = carry
      for (; d < len; d += RIVER_SPACING) {
        const t = d / len
        const lat = y1 + (y2 - y1) * t
        const w = waves.reduce((a, { f, ph }) => a + Math.sin(f * (arc + d) + ph), 0) / 2
        if (rnd.uniform(0, 1) > Math.max(0.15, 0.7 + 0.5 * w) * populated(lat)) continue
        const k = Math.max(0.3, Math.cos((lat * Math.PI) / 180))
        out.push([lat + rnd.gauss(0, 0.08), x1 + (x2 - x1) * t + rnd.gauss(0, 0.08) / k, rnd.uniform(0.6, 1)])
      }
      carry = d - len
      arc += len
    }
  }
  return out
}

export function makeCityLights(seed = 21): CityLight[] {
  const rnd = mulberry32(seed)
  const out: CityLight[] = []
  const rad = (d: number): number => (d * Math.PI) / 180
  for (const [lat, lon] of CITIES) {
    const candidates: Array<[number, number, number, boolean]> = [[lat, lon, 1.5, true]]
    for (let i = 0; i < CITY_DOTS; i++) {
      candidates.push([lat + rnd.gauss(0, CITY_SPREAD), lon + rnd.gauss(0, CITY_SPREAD), rnd.uniform(0.6, 1), false])
    }
    for (const [la, lo, size, core] of candidates) {
      if (!inLand(la, lo) && !(core && distToCoast(la, lo) < 0.4)) continue // a port city sits right on the shore
      const a = rad(la)
      const b = rad(lo)
      out.push({ x: Math.cos(a) * Math.sin(b), y: Math.sin(a), z: Math.cos(a) * Math.cos(b), size, core, phase: rnd.uniform(0, 2 * Math.PI) })
    }
  }
  for (const [la, lo, size] of [...makeCoastLights(rnd), ...makeRiverLights(rnd)]) {
    if (!inLand(la, lo)) continue // a light must never sit on the sea
    const a = rad(la)
    const b = rad(lo)
    out.push({ x: Math.cos(a) * Math.sin(b), y: Math.sin(a), z: Math.cos(a) * Math.cos(b), size, core: false, phase: rnd.uniform(0, 2 * Math.PI) })
  }
  return out
}
