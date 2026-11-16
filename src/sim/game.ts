/** The game: the turtle, the ISS, levels, collisions and the burning of a caught station.
 *  Logic only: nothing here draws, and nothing here knows about three.js or React. */
import {
  BUMP_COOLDOWN, BUMP_LEVELS, BUMP_RADIUS, BUMP_TURN, BURN_ANIMATION, CATCH_RADIUS, EFFECT_LIFE, ISS_ALT_RANGE,
  ISS_PHASE, ISS_SPAWN_CLEARANCE, PLAYER_ALT_RANGE, PLAYER_ALT_STEP, PLAYER_REF_ALT, PLAYER_TURN_STEP,
  SAT_SPAWN_CLEARANCE, SPEED, WOBBLE_LIFE,
} from './config'
import { startBurn, wreckState } from './burn'
import { issOmega, turtleSpeed } from './levels'
import { makeIssOrbit, makeOrbits } from './orbits'
import type { Rng } from './rng'
import type { Effect, EffectKind, GameState } from './types'
import { add, cross, dist, dot, length, mul, onOrbit, orbitBasis, sub, unit, type V3 } from './vec'

export function createGame(rng: Rng): GameState {
  const issOrbit = makeIssOrbit()
  const p0 = unit([-0.55, -0.25, 0.8])
  return {
    tick: 0,
    angle: 0,
    score: 0,
    layers: { game: true, iss: true, sats: true },
    orbits: makeOrbits(),
    iss: { ...issOrbit, omega: issOmega(issOrbit.r, 1), theta: ISS_PHASE },
    player: { p: p0, t: unit(cross([0, 1, 0], p0)), alt: PLAYER_REF_ALT, hit: 0, wobble: 0 },
    wrecks: [],
    effects: [],
    events: [],
    rng,
  }
}

/** Game level = number of caught ISS + 1. */
export const level = (g: GameState): number => g.score + 1

/** How many ordinary satellites fly: none on level 1, then one more per level (up to SATELLITE_COUNT).
 *  With the game switched off all of them fly (the plain screensaver). */
export function activeSatellites(g: GameState): number {
  if (!g.layers.game) return g.orbits.length
  return Math.min(g.orbits.length, level(g) - 1)
}

export const issPos = (g: GameState): V3 => onOrbit(g.iss.r, g.iss.u, g.iss.v, g.iss.theta)
export const playerPos = (g: GameState): V3 => mul(g.player.p, g.player.alt)

/** Turns the velocity direction t about the radial axis p (a plane change). radians > 0 turns left. */
export function rotateHeading(p: V3, t: V3, radians: number): V3 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  const w = cross(p, t)
  return unit([t[0] * c + w[0] * s, t[1] * c + w[1] * s, t[2] * c + w[2] * s])
}

/** All altitudes the turtle can fly (Earth radii): PLAYER_ALT_RANGE in steps of PLAYER_ALT_STEP. */
export function altLevels(): number[] {
  const [lo, hi] = PLAYER_ALT_RANGE
  const n = Math.round((hi - lo) / PLAYER_ALT_STEP) + 1
  return Array.from({ length: n }, (_, i) => lo + i * PLAYER_ALT_STEP)
}

/** The altitudes a new ISS can appear at: the turtle's steps inside ISS_ALT_RANGE (so they can be matched exactly). */
export function issAltitudes(): number[] {
  const [lo, hi] = ISS_ALT_RANGE
  return altLevels().filter((a) => a >= lo - 1e-9 && a <= hi + 1e-9)
}

/** One Left (+1) / Right (-1) press: turns the orbit by PLAYER_TURN_STEP. */
export function turnPlayer(g: GameState, sign: 1 | -1): void {
  const pl = g.player
  pl.t = rotateHeading(pl.p, pl.t, sign * PLAYER_TURN_STEP)
}

/** One Up (+1) / Down (-1) press: moves the orbit one altitude step up / down (snapped to the altitude grid). */
export function climbPlayer(g: GameState, sign: 1 | -1): void {
  const [lo, hi] = PLAYER_ALT_RANGE
  const lvl = Math.round((g.player.alt - lo) / PLAYER_ALT_STEP) + sign
  g.player.alt = Math.min(hi, Math.max(lo, lo + lvl * PLAYER_ALT_STEP))
}

function addEffect(g: GameState, kind: EffectKind, pos: V3): void {
  g.effects.push({ x: pos[0], y: pos[1], age: 0, kind } satisfies Effect)
  g.events.push(kind)
}

/** Puts the ISS on a new random orbit, at least ISS_SPAWN_CLEARANCE away from the point `avoid` (the turtle). */
export function spawnIss(g: GameState, avoid: V3): void {
  const rnd = g.rng
  let u!: V3, v!: V3
  let alt = 0
  let theta = 0
  for (let i = 0; i < 40; i++) {
    ;[u, v] = orbitBasis([rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1)])
    alt = rnd.choice(issAltitudes())
    theta = rnd.uniform(0, 2 * Math.PI)
    if (dist(onOrbit(alt, u, v, theta), avoid) > ISS_SPAWN_CLEARANCE) break
  }
  g.iss = { r: alt, u, v, omega: issOmega(alt, level(g)), theta }
}

/** Positions of the ordinary satellites that are flying right now. */
export function satellitePositions(g: GameState): V3[] {
  return g.orbits
    .slice(0, activeSatellites(g))
    .map(({ r, u, v, omega, phase }) => onOrbit(r, u, v, phase + omega * g.tick))
}

/** A new level brings satellite number `index`: it appears on its own orbit, but never right on top of the turtle
 *  (its position on the orbit is re-rolled until it is further than SAT_SPAWN_CLEARANCE from `avoid`). */
export function activateSatellite(g: GameState, index: number, avoid: V3): void {
  const o = g.orbits[index]
  let phase = o.phase
  let pos = onOrbit(o.r, o.u, o.v, phase + o.omega * g.tick)
  for (let i = 0; i < 80; i++) {
    phase = g.rng.uniform(0, 2 * Math.PI)
    pos = onOrbit(o.r, o.u, o.v, phase + o.omega * g.tick)
    if (dist(pos, avoid) > SAT_SPAWN_CLEARANCE) break
  }
  g.orbits[index] = { ...o, phase }
  addEffect(g, 'spawn', pos) // a blue ring marks where it appeared
}

/** A satellite hit: the orbit is knocked slightly off - the velocity turns away from the satellite and the
 *  altitude changes a little (away from the satellite's altitude). */
export function bumpPlayer(g: GameState, sat: V3): void {
  const pl = g.player
  const rel = sub(sat, playerPos(g))
  let side = dot(cross(pl.p, pl.t), rel) // > 0: the satellite is on the turtle's left
  if (Math.abs(side) < 1e-6) side = g.rng.choice([-1, 1])
  const turn = BUMP_TURN * g.rng.uniform(0.7, 1.3)
  pl.t = rotateHeading(pl.p, pl.t, -Math.sign(side) * turn)
  const pushedDown = length(sat) > pl.alt
  const times = g.rng.choice(BUMP_LEVELS)
  for (let i = 0; i < times; i++) climbPlayer(g, pushedDown ? -1 : 1)
  pl.hit = BUMP_COOLDOWN
  pl.wobble = WOBBLE_LIFE
  addEffect(g, 'bump', playerPos(g))
}

/** Advances every wreck by `steps`; a wreck whose time is up ends with a flash. */
export function updateBurn(g: GameState, steps: number): void {
  g.wrecks = g.wrecks.filter((w) => {
    w.age += steps
    w.p = wreckState(w, w.age).p
    if (w.age >= w.tFall + w.tFire) {
      addEffect(g, 'burnout', w.p)
      return false
    }
    return true
  })
}

/** Moves the turtle along its orbit (Kepler-style: lower = faster), then checks the catch and the hits.
 *  Steering and altitude are NOT handled here: they change only on key presses (turnPlayer / climbPlayer). */
export function updateGame(g: GameState, steps: number): void {
  const pl = g.player
  const phi = turtleSpeed(pl.alt) * steps
  const c = Math.cos(phi)
  const s = Math.sin(phi)
  const p = unit(add(mul(pl.p, c), mul(pl.t, s)))
  let t = add(mul(pl.t, c), mul(pl.p, -s)) // uses the OLD p (the position before this step)
  t = unit(sub(t, mul(p, dot(t, p)))) // keep t exactly perpendicular to p
  pl.p = p
  pl.t = t
  pl.hit = Math.max(0, pl.hit - steps)
  pl.wobble = Math.max(0, pl.wobble - steps)
  const pos = playerPos(g)

  if (g.layers.iss && dist(pos, issPos(g)) < CATCH_RADIUS) {
    g.score += 1
    addEffect(g, 'capture', issPos(g))
    if (BURN_ANIMATION) g.wrecks.push(startBurn(g.iss)) // the caught station falls and burns up
    spawnIss(g, pos) // faster than before: it already uses the new level
    if (level(g) - 1 <= g.orbits.length) activateSatellite(g, level(g) - 2, pos) // this level adds a satellite
  }
  if (g.layers.sats && pl.hit <= 0) {
    for (const sat of satellitePositions(g)) {
      if (dist(sat, pos) < BUMP_RADIUS) {
        bumpPlayer(g, sat)
        break
      }
    }
  }

  updateBurn(g, steps)
  for (const e of g.effects) e.age += steps
  g.effects = g.effects.filter((e) => e.age < EFFECT_LIFE)
}

/** One frame of the whole simulation, `steps` ticks long (the fixed-step loop calls it with 1). The ISS flies its
 *  orbit also when the game layer is off; the globe turns; time moves on. */
export function step(g: GameState, steps: number): void {
  g.iss.theta += g.iss.omega * steps
  if (g.layers.game) updateGame(g, steps)
  else if (g.wrecks.length) g.wrecks = []
  g.angle = (g.angle + SPEED * steps) % (2 * Math.PI)
  g.tick += steps
}

