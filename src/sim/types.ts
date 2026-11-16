import type { Orbit } from './orbits'
import type { Rng } from './rng'
import type { V3 } from './vec'

export interface Player {
  /** unit vector from the Earth's centre to the turtle */
  p: V3
  /** unit velocity direction (perpendicular to p) */
  t: V3
  /** orbit radius, Earth radii */
  alt: number
  /** steps of immunity left after a collision */
  hit: number
  /** steps of tumbling left after a collision */
  wobble: number
}

export interface Iss {
  r: number
  u: V3
  v: V3
  omega: number
  theta: number
}

/** A caught station that is falling / burning. */
export interface Wreck {
  u0: V3
  r0: number
  drift: V3
  age: number
  p: V3
  tFall: number
  tFire: number
}

export type EffectKind = 'capture' | 'bump' | 'spawn' | 'burnout'

/** Things that happened in the simulation, for the outside world (sound): one per ring flash. The consumer drains the
 *  list; the simulation only ever appends to it. */
export type GameEvent = EffectKind

/** A ring flash at world position (x, y) (Earth radii), `age` steps old. */
export interface Effect {
  x: number
  y: number
  age: number
  kind: EffectKind
}

/** Which layers the player has switched on: they change the rules (the game off = a plain screensaver). */
export interface Layers {
  game: boolean
  iss: boolean
  sats: boolean
}

export interface GameState {
  /** simulation time in steps */
  tick: number
  /** how far the globe has turned, radians */
  angle: number
  score: number
  layers: Layers
  /** the 10 ordinary satellites (phases get re-rolled as they are activated) */
  orbits: Orbit[]
  iss: Iss
  player: Player
  wrecks: Wreck[]
  effects: Effect[]
  /** events since the consumer last drained the list (`events.splice(0)`) */
  events: GameEvent[]
  rng: Rng
}
