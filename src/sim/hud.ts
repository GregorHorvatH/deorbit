/** The numbers behind the table of instruments. Pure: colours and formatting live in the UI. */
import { PLAYER_ALT_STEP, STEPS_PER_SECOND } from './config'
import { interceptForecast, issBearing } from './forecast'
import { activeSatellites, issPos, level, playerPos } from './game'
import { turtleSpeed } from './levels'
import type { GameState } from './types'
import { dist } from './vec'

export interface HudSnapshot {
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
