/** Speeds and difficulty. */
import {
  ISS_SPEED_DECAY, ISS_SPEED_FIRST_STEP, ISS_SPEED_MAX, ISS_SPEED_MIN_STEP, ISS_SPEED_START, PLAYER_REF_ALT,
  PLAYER_SPEED,
} from './config'

/** The turtle's orbital speed (rad per step) at altitude alt (Earth radii): lower orbits are faster (Kepler). */
export const turtleSpeed = (alt: number): number => PLAYER_SPEED * (PLAYER_REF_ALT / alt) ** 1.5

/** The ISS speed on level lvl as a fraction of the turtle's speed on the same orbit: ISS_SPEED_START, then big
 *  steps that shrink until ISS_SPEED_MAX. */
export function issSpeedFraction(lvl: number): number {
  let fraction = ISS_SPEED_START
  let step = ISS_SPEED_FIRST_STEP
  for (let i = 0; i < lvl - 1; i++) {
    fraction = Math.min(ISS_SPEED_MAX, fraction + step)
    step = Math.max(ISS_SPEED_MIN_STEP, step * ISS_SPEED_DECAY)
  }
  return fraction
}

/** The ISS orbital speed (rad per step) at altitude alt on level lvl. */
export const issOmega = (alt: number, lvl: number): number => issSpeedFraction(lvl) * turtleSpeed(alt)
