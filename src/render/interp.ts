/** Where things are `alpha` of a step AFTER the last simulated step: orbits are analytic, so the render can sit
 *  between two fixed steps and stay smooth on any refresh rate. */
import { mul, onOrbit, turtleSpeed, type GameState, type V3 } from '../sim'

export function issAt(g: GameState, alpha: number): V3 {
  return onOrbit(g.iss.r, g.iss.u, g.iss.v, g.iss.theta + g.iss.omega * alpha)
}

export interface PlayerPose {
  /** position, Earth radii */
  pos: V3
  /** unit radial and unit velocity directions */
  p: V3
  t: V3
}

export function playerAt(g: GameState, alpha: number): PlayerPose {
  const { p, t, alt } = g.player
  const a = turtleSpeed(alt) * alpha
  const c = Math.cos(a)
  const s = Math.sin(a)
  const pp: V3 = [p[0] * c + t[0] * s, p[1] * c + t[1] * s, p[2] * c + t[2] * s]
  const tt: V3 = [t[0] * c - p[0] * s, t[1] * c - p[1] * s, t[2] * c - p[2] * s]
  return { pos: mul(pp, alt), p: pp, t: tt }
}

