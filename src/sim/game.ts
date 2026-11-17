/** The game: the turtle, the ISS, levels, collisions and the burning of a caught station.
 *  Logic only: nothing here draws, and nothing here knows about three.js or React. */
import {
  BARREL_BELOW, BARREL_FUEL, BEEP_STEPS, ENDING_DELAY_STEPS, DANGER_BEEP_STEPS, WARN_STEPS, BARREL_LIFE_STEPS, BARREL_SPEED, BUMP_COOLDOWN, BUMP_LEVELS, BUMP_RADIUS, BUMP_TURN, BURN_ANIMATION, CATCH_RADIUS, DECAY_STEPS, EFFECT_LIFE, FUEL_DOWN,
  FUEL_MAX, FUEL_PER_CATCH, FUEL_TURN, FUEL_UP, HEART_HEAL, HEART_LIFE_STEPS, HEART_SPEED, HULL_MAX, ISS_ALT_RANGE,
  ISS_PHASE, ISS_SPAWN_CLEARANCE, JET_STEPS, PLAYER_ALT_RANGE, PLAYER_ALT_STEP, PLAYER_REF_ALT, PLAYER_TURN_STEP,
  SAT_SPAWN_CLEARANCE, SPEED, STEPS_PER_SECOND, WOBBLE_LIFE,
} from './config'
import { startBurn, wreckState } from './burn'
import { FINAL_LEVEL, issOmega, turtleSpeed } from './levels'
import { makeIssOrbit, makeOrbits } from './orbits'
import { mulberry32, type Rng } from './rng'
import type { Effect, EffectKind, GameState, LostReason, SteerKind } from './types'
import { add, cross, dist, dot, length, mul, onOrbit, orbitBasis, sub, unit, type V3 } from './vec'

/** Steps until the next heart may appear: 20-30 seconds, fixed by how many there have been (no random numbers are used). */
const heartDelay = (serial: number): number => (20 + ((serial * 7) % 11)) * STEPS_PER_SECOND
/** Steps until the next barrel may appear: 25-35 seconds. */
const barrelDelay = (serial: number): number => (25 + ((serial * 7) % 11)) * STEPS_PER_SECOND

export function createGame(rng: Rng): GameState {
  const issOrbit = makeIssOrbit()
  const p0 = unit([-0.55, -0.25, 0.8])
  return {
    status: 'playing',
    lostReason: null,
    hull: HULL_MAX,
    fuel: FUEL_MAX,
    decay: DECAY_STEPS,
    elapsed: 0,
    heart: null,
    heartTimer: heartDelay(0),
    heartSerial: 0,
    barrel: null,
    barrelTimer: barrelDelay(0),
    barrelSerial: 0,
    endDelay: ENDING_DELAY_STEPS,
    jet: null,
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

/** True in the last WARN_SECONDS before the orbit sinks. */
export const inWarning = (g: GameState): boolean => g.decay <= WARN_STEPS

/** Up pressed while the alarm sounds: the engines hold the orbit against the drag. The altitude does not change, the
 *  alarm stops and the countdown starts over; it costs the fuel of a climb (without it the orbit sinks as usual). */
function holdAltitude(g: GameState): boolean {
  if (g.fuel < FUEL_UP) return false
  g.fuel -= FUEL_UP
  g.decay = DECAY_STEPS
  g.jet = { kind: 'up', life: JET_STEPS }
  g.events.push('hold')
  return true
}

/** A key press of the player: costs fuel, and only works while the game is on and there is fuel and room to move.
 *  Returns whether anything happened. (turnPlayer / climbPlayer are the free versions the rules use themselves.) */
export function steerPlayer(g: GameState, kind: SteerKind): boolean {
  if (g.status !== 'playing' || !g.layers.game) return false
  const [lo, hi] = PLAYER_ALT_RANGE
  if (kind === 'up' && inWarning(g)) return holdAltitude(g) // in the alarm window Up holds the orbit instead of raising it
  if (kind === 'up' && g.player.alt >= hi - 1e-9) return false // already on the highest orbit: nothing to do, nothing to pay
  if (kind === 'down' && g.player.alt <= lo + 1e-9) return false
  const cost = kind === 'up' ? FUEL_UP : kind === 'down' ? FUEL_DOWN : FUEL_TURN
  if (g.fuel < cost) return false
  g.fuel -= cost
  // The camera looks at the globe from one side only. Behind the Earth (p.z < 0) the sphere is seen from the inside, so the
  // turtle's own left appears on the screen's right: there the keys follow the turtle as drawn, so Left still turns it left.
  const side: 1 | -1 = g.player.p[2] < 0 ? -1 : 1
  if (kind === 'left') turnPlayer(g, side)
  else if (kind === 'right') turnPlayer(g, side === 1 ? -1 : 1)
  else climbPlayer(g, kind === 'up' ? 1 : -1)
  g.jet = { kind, life: JET_STEPS }
  return true
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
  g.hull = Math.max(0, g.hull - 1)
  if (g.hull === 0) loseGame(g, 'hull')
}

/** The game is won or lost but the end screen is not due yet: something is still falling and burning (the turtle, the last
 *  station), and then there is one second more to look at the empty sky. */
export const endPending = (g: GameState): boolean => (g.status === 'lost' || g.status === 'won') && (g.wrecks.length > 0 || g.endDelay > 0)

/** The mission is over: the turtle falls and burns where it is. */
export function loseGame(g: GameState, reason: LostReason): void {
  if (g.status !== 'playing') return
  const pl = g.player
  g.status = 'lost'
  g.endDelay = ENDING_DELAY_STEPS
  g.lostReason = reason
  g.jet = null
  g.wrecks.push(startBurn({ r: pl.alt, u: pl.p, v: pl.t, omega: turtleSpeed(pl.alt), theta: 0 }, 'turtle'))
  g.events.push('lost')
}

/** The Earth is saved from this station for good: the last catch wins. */
function winGame(g: GameState): void {
  g.status = 'won'
  g.endDelay = ENDING_DELAY_STEPS
  g.jet = null
  g.events.push('won')
}

/** A random orbit at one of the turtle's altitude levels, clear of the turtle, from its own seeded generator (a pickup
 *  never touches the main one, so the sequence of ISS orbits stays the same whatever else appears). */
function pickupOrbit(seed: number, avoid: V3): { r: number; u: V3; v: V3; theta: number } {
  const rnd = mulberry32(seed)
  let u!: V3, v!: V3
  let alt = 0
  let theta = 0
  for (let i = 0; i < 40; i++) {
    ;[u, v] = orbitBasis([rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1)])
    alt = rnd.choice(altLevels())
    theta = rnd.uniform(0, 2 * Math.PI)
    if (dist(onOrbit(alt, u, v, theta), avoid) > ISS_SPAWN_CLEARANCE) break
  }
  return { r: alt, u, v, theta }
}

/** A new heart. */
export function spawnHeart(g: GameState, avoid: V3): void {
  const o = pickupOrbit(0x9e3779b1 ^ Math.imul(g.heartSerial + 1, 0x85ebca6b), avoid)
  g.heartSerial++
  g.heart = { ...o, omega: HEART_SPEED * turtleSpeed(o.r), life: HEART_LIFE_STEPS }
  addEffect(g, 'spawn', onOrbit(o.r, o.u, o.v, o.theta))
}

/** A new barrel of fuel. */
export function spawnBarrel(g: GameState, avoid: V3): void {
  const o = pickupOrbit(0x7f4a7c15 ^ Math.imul(g.barrelSerial + 1, 0xc2b2ae35), avoid)
  g.barrelSerial++
  g.barrel = { ...o, omega: BARREL_SPEED * turtleSpeed(o.r), life: BARREL_LIFE_STEPS }
  addEffect(g, 'spawn', onOrbit(o.r, o.u, o.v, o.theta))
}

/** The heart: appears from time to time while the hull is damaged; caught = one hull point back; not caught = it falls and burns. */
function updateHeart(g: GameState, steps: number, pos: V3): void {
  const h = g.heart
  if (!h) {
    if (g.hull < HULL_MAX) {
      g.heartTimer -= steps
      if (g.heartTimer <= 0) spawnHeart(g, pos)
    }
    return
  }
  const hp = onOrbit(h.r, h.u, h.v, h.theta)
  if (dist(pos, hp) < CATCH_RADIUS) {
    g.hull = Math.min(HULL_MAX, g.hull + HEART_HEAL)
    addEffect(g, 'heal', hp)
    g.heart = null
    g.heartTimer = heartDelay(g.heartSerial)
    return
  }
  h.life -= steps
  if (h.life <= 0) {
    g.wrecks.push(startBurn(h, 'heart'))
    g.events.push('heartLost')
    g.heart = null
    g.heartTimer = heartDelay(g.heartSerial)
  }
}

/** The barrel of fuel: appears from time to time while the tank is low; caught = BARREL_FUEL back; not caught = it falls and burns. */
function updateBarrel(g: GameState, steps: number, pos: V3): void {
  const b = g.barrel
  if (!b) {
    if (g.fuel < FUEL_MAX * BARREL_BELOW) {
      g.barrelTimer -= steps
      if (g.barrelTimer <= 0) spawnBarrel(g, pos)
    }
    return
  }
  const bp = onOrbit(b.r, b.u, b.v, b.theta)
  if (dist(pos, bp) < CATCH_RADIUS) {
    g.fuel = Math.min(FUEL_MAX, g.fuel + BARREL_FUEL)
    addEffect(g, 'refuel', bp)
    g.barrel = null
    g.barrelTimer = barrelDelay(g.barrelSerial)
    return
  }
  b.life -= steps
  if (b.life <= 0) {
    g.wrecks.push(startBurn(b, 'barrel'))
    g.events.push('barrelLost')
    g.barrel = null
    g.barrelTimer = barrelDelay(g.barrelSerial)
  }
}

/** Air drag: one level lower every DECAY_SECONDS; below the lowest orbit the turtle burns up. */
function updateDecay(g: GameState, steps: number): void {
  const before = g.decay
  g.decay -= steps
  if (g.decay > 0) {
    if (g.decay <= WARN_STEPS) {
      // the alarm: a beep when the window opens and then every few steps; on the lowest orbit twice as often and harsher
      const danger = g.player.alt <= PLAYER_ALT_RANGE[0] + 1e-9
      const every = danger ? DANGER_BEEP_STEPS : BEEP_STEPS
      if (before > WARN_STEPS || Math.floor(before / every) !== Math.floor(g.decay / every)) g.events.push(danger ? 'danger' : 'warn')
    }
    return
  }
  g.decay += DECAY_STEPS
  if (g.player.alt <= PLAYER_ALT_RANGE[0] + 1e-9) {
    loseGame(g, 'reentry')
    return
  }
  climbPlayer(g, -1)
  g.events.push('decay')
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

  g.elapsed += steps
  if (g.layers.iss && dist(pos, issPos(g)) < CATCH_RADIUS) {
    g.score += 1
    g.fuel = Math.min(FUEL_MAX, g.fuel + FUEL_PER_CATCH) // the station's fuel tank
    addEffect(g, 'capture', issPos(g))
    if (BURN_ANIMATION) g.wrecks.push(startBurn(g.iss)) // the caught station falls and burns up
    if (g.score >= FINAL_LEVEL) winGame(g) // the last, fastest station: that is the game
    spawnIss(g, pos) // faster than before: it already uses the new level
    if (level(g) - 1 <= g.orbits.length) activateSatellite(g, level(g) - 2, pos) // this level adds a satellite
  }
  if (g.status === 'playing') updateHeart(g, steps, pos)
  if (g.status === 'playing') updateBarrel(g, steps, pos)
  if (g.status === 'playing') updateDecay(g, steps)
  if (g.status === 'playing' && g.layers.sats && pl.hit <= 0) {
    for (const sat of satellitePositions(g)) {
      if (dist(sat, pos) < BUMP_RADIUS) {
        bumpPlayer(g, sat)
        break
      }
    }
  }

  settle(g, steps)
}

/** Everything that plays out by itself: the falling wrecks, the ring flashes, the thruster puff. It goes on after the
 *  game is won or lost. */
export function settle(g: GameState, steps: number): void {
  const burning = g.wrecks.length > 0 // the second of calm starts counting only AFTER the step the last fire goes out in
  updateBurn(g, steps)
  for (const e of g.effects) e.age += steps
  g.effects = g.effects.filter((e) => e.age < EFFECT_LIFE)
  if ((g.status === 'won' || g.status === 'lost') && !burning && g.wrecks.length === 0) g.endDelay = Math.max(0, g.endDelay - steps)
  if (g.jet) {
    g.jet.life -= steps
    if (g.jet.life <= 0) g.jet = null
  }
}

/** One frame of the whole simulation, `steps` ticks long (the fixed-step loop calls it with 1). The ISS flies its
 *  orbit also when the game layer is off; the globe turns; time moves on. */
export function step(g: GameState, steps: number): void {
  if (g.status === 'paused') return
  g.iss.theta += g.iss.omega * steps
  if (g.heart) g.heart.theta += g.heart.omega * steps
  if (g.barrel) g.barrel.theta += g.barrel.omega * steps
  if (g.layers.game) {
    if (g.status === 'playing') updateGame(g, steps)
    else settle(g, steps) // the title screen and the end screens: the world goes on, the rules do not
  } else if (g.wrecks.length) g.wrecks = []
  g.angle = (g.angle + SPEED * steps) % (2 * Math.PI)
  g.tick += steps
}


/** Starts the game over on a new random sequence; the layer switches the player has made stay as they are. */
export function resetGame(g: GameState, rng: Rng): void {
  const layers = g.layers
  Object.assign(g, createGame(rng))
  g.layers = layers
}
