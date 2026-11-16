/** The background stars: a normal-window set outside the globe and
 *  its glow, then stars of the same density far beyond the edges (for big screens). Positions in Earth radii;
 *  sizes stay in DESIGN pixels (they scale with the window, not with the zoom of the world). */
import { mulberry32, px, RADIUS_PX } from '../sim'
import { ATMO_WIDTH, STAR_COLORS, STAR_COUNT } from './style'

const STAR_WORLD = 1300 // half-size of the star "universe", design pixels
const WIDTH = 700
const HEIGHT = 800

export interface StarData {
  x: number
  y: number
  size: number
  color: string
  phase: number
  speed: number
}

export function makeStars(seed = 3): StarData[] {
  const rnd = mulberry32(seed)
  const halfW = WIDTH / 2 - 8
  const halfH = HEIGHT / 2 - 8
  const near = RADIUS_PX + ATMO_WIDTH * RADIUS_PX + 8
  const areaIn = 2 * halfW * 2 * halfH
  const extra = Math.round((STAR_COUNT * ((2 * STAR_WORLD) ** 2 - areaIn)) / areaIn)
  const star = (x: number, y: number): StarData => ({
    x: px(x),
    y: px(y),
    size: rnd.choice([0.5, 0.6, 0.6, 0.8, 1.0]),
    color: rnd.choice(STAR_COLORS),
    phase: rnd.uniform(0, 2 * Math.PI),
    speed: rnd.uniform(0.008, 0.025),
  })
  const stars: StarData[] = []
  while (stars.length < STAR_COUNT) {
    const x = rnd.uniform(-halfW, halfW)
    const y = rnd.uniform(-halfH, halfH)
    if (Math.hypot(x, y) >= near) stars.push(star(x, y))
  }
  while (stars.length < STAR_COUNT + extra) {
    const x = rnd.uniform(-STAR_WORLD, STAR_WORLD)
    const y = rnd.uniform(-STAR_WORLD, STAR_WORLD)
    if (Math.abs(x) >= halfW || Math.abs(y) >= halfH) stars.push(star(x, y))
  }
  return stars
}
