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

export type GameStatus = 'ready' | 'playing' | 'paused' | 'won' | 'lost'
export type LostReason = 'hull' | 'reentry'
export type SteerKind = 'left' | 'right' | 'up' | 'down'
export type WreckKind = 'iss' | 'turtle'

/** A heart on its orbit: the same shape as the ISS. It stays until it is caught. */
export type Heart = Iss

/** A barrel of fuel on its orbit: the same shape as a heart. */
export type Barrel = Heart

/** A falling / burning thing: the caught station, or the lost turtle. */
export interface Wreck {
  kind: WreckKind
  u0: V3
  r0: number
  drift: V3
  age: number
  p: V3
  tFall: number
  tFire: number
}

export type EffectKind = 'capture' | 'bump' | 'spawn' | 'burnout' | 'heal' | 'refuel'

/** Things that happened in the simulation, for the outside world (sound): one per ring flash. The consumer drains the
 *  list; the simulation only ever appends to it. */
export type GameEvent = EffectKind | 'decay' | 'lost' | 'won' | 'warn' | 'danger' | 'hold'

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
  status: GameStatus
  lostReason: LostReason | null
  /** hull points left */
  hull: number
  fuel: number
  /** steps until the orbit sinks one level */
  decay: number
  /** steps played (not counting a pause) */
  elapsed: number
  heart: Heart | null
  /** steps until the next heart may appear (counts down only while hull is missing and no heart flies) */
  heartTimer: number
  /** hearts made so far (seeds the next one: they never touch `rng`) */
  heartSerial: number
  barrel: Barrel | null
  barrelTimer: number
  barrelSerial: number
  /** steps still to wait (once nothing burns any more) before the end screen may show
   *  (counts down only after a win or a loss) */
  endDelay: number
  /** the thruster puff of the last key press (drawn beside the turtle) */
  jet: { kind: SteerKind; life: number } | null
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
