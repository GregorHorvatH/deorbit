/** The numbers behind the table of instruments. Pure: colours and formatting live in the UI. */
import { FUEL_MAX, FUEL_UP, HULL_MAX, PLAYER_ALT_RANGE, PLAYER_ALT_STEP, STEPS_PER_SECOND } from './config'
import { interceptForecast, issBearing } from './forecast'
import { activeSatellites, inWarning, issPos, level, playerPos, endPending } from './game'
import { FINAL_LEVEL, turtleSpeed } from './levels'
import type { GameState, GameStatus, LostReason } from './types'
import { dist } from './vec'

export interface HudSnapshot {
  status: GameStatus
  lostReason: LostReason | null
  hull: number
  hullMax: number
  fuel: number
  fuelMax: number
  /** seconds until the orbit sinks one level */
  decayIn: number
  /** won or lost, but the fire is not out yet (or the last second has not passed): show the end screen only when this is false */
  ending: boolean
  /** the alarm sounds: Up holds the altitude now (and the fuel for it is there) */
  warning: boolean
  canHold: boolean
  /** the turtle is on the lowest orbit: the next sinking burns it up */
  lowest: boolean
  /** seconds a heart has left, null = no heart flies */
  heart: number | null
  /** seconds a barrel of fuel has left, null = none flies */
  barrel: number | null
  /** seconds played */
  elapsed: number
  /** the level on which catching the ISS wins */
  finalLevel: number
  score: number
  level: number
  /** satellites flying now */
  sats: number
  /** altitudes, Earth radii */
  issAlt: number
  turAlt: number
  /** orbital speeds, degrees per second */
  issSpeed: number
  turSpeed: number
  /** distance turtle - ISS, Earth radii */
  dst: number
  /** where the ISS is relative to the heading: > 0 left, < 0 right, degrees */
  bearing: number
  /** seconds to the closest pass if nothing is pressed; null = the two only move apart */
  eta: number | null
  /** the distance at that moment, Earth radii */
  miss: number
  /** altitude levels between the two orbits */
  levelsOff: number
}

const deg = (omega: number): number => (omega * STEPS_PER_SECOND * 180) / Math.PI

export function hudSnapshot(g: GameState): HudSnapshot {
  const { eta, miss } = interceptForecast(g)
  const issAlt = g.iss.r
  return {
    status: g.status,
    lostReason: g.lostReason,
    hull: g.hull,
    hullMax: HULL_MAX,
    fuel: g.fuel,
    fuelMax: FUEL_MAX,
    decayIn: Math.max(0, g.decay / STEPS_PER_SECOND),
    ending: endPending(g),
    warning: inWarning(g),
    canHold: g.fuel >= FUEL_UP,
    lowest: g.player.alt <= PLAYER_ALT_RANGE[0] + 1e-9,
    heart: g.heart ? Math.max(0, g.heart.life / STEPS_PER_SECOND) : null,
    barrel: g.barrel ? Math.max(0, g.barrel.life / STEPS_PER_SECOND) : null,
    elapsed: g.elapsed / STEPS_PER_SECOND,
    finalLevel: FINAL_LEVEL,
    score: g.score,
    level: level(g),
    sats: activeSatellites(g),
    issAlt,
    turAlt: g.player.alt,
    issSpeed: deg(g.iss.omega),
    turSpeed: deg(turtleSpeed(g.player.alt)),
    dst: dist(issPos(g), playerPos(g)),
    bearing: issBearing(g),
    eta,
    miss,
    levelsOff: Math.round(Math.abs(g.player.alt - issAlt) / PLAYER_ALT_STEP),
  }
}
