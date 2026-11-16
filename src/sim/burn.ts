/** The caught ISS falls and burns up. Logic only. */
import {
  ATMO_WIDTH, BURN_DRIFT, BURN_END, BURN_FALL, BURN_FALL_MIN, BURN_FIRE, ISS_ALT_RANGE, px, STEPS_PER_SECOND,
} from './config'
import { clamp01, dot, length, mul, unit, type V3 } from './vec'
import type { Iss, Wreck, WreckKind } from './types'
import { onOrbit } from './vec'

/** The top of the air: the fire starts when the station reaches this radius. */
export const R_ATM = 1 + ATMO_WIDTH
export const R_END = 1 + BURN_END

export type BurnPhase = 'fall' | 'fire'

/** The station has just been caught: it starts to fall from where it was. Call this BEFORE the ISS is respawned.
 *  A station caught on a higher orbit has a longer way down, so it falls for longer. */
export function startBurn(iss: Iss, kind: WreckKind = 'iss'): Wreck {
  const { theta, r, u, v } = iss
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  const pos = onOrbit(r, u, v, theta)
  const r0 = length(pos)
  const tangent = unit([-s * u[0] + c * v[0], -s * u[1] + c * v[1], -s * u[2] + c * v[2]]) // direction it was flying
  const drift = Math.min(BURN_DRIFT, r * iss.omega * 20) // what it would cover in half a second
  const span = Math.max(px(1), ISS_ALT_RANGE[1] - R_ATM)
  const high = clamp01((r0 - R_ATM) / span) // 0 = just above the air, 1 = the highest orbit
  return {
    kind,
    u0: mul(pos, 1 / r0),
    r0,
    drift: mul(tangent, drift),
    age: 0,
    p: pos,
    tFall: STEPS_PER_SECOND * (BURN_FALL_MIN + (BURN_FALL - BURN_FALL_MIN) * high),
    tFire: STEPS_PER_SECOND * BURN_FIRE,
  }
}

/** Where the wreck is `age` steps after the catch and in which phase, with progress q in 0..1.
 *  Falling is ease-in (it accelerates), burning is ease-out (the air slows it down). */
export function wreckState(w: Wreck, age: number): { p: V3; phase: BurnPhase; q: number } {
  const { tFall, tFire } = w
  let phase: BurnPhase
  let q: number
  let r: number
  if (age < tFall) {
    phase = 'fall'
    q = age / tFall
    r = w.r0 + (R_ATM - w.r0) * q * q
  } else {
    q = clamp01((age - tFall) / tFire)
    phase = 'fire'
    r = R_ATM + (R_END - R_ATM) * (1 - (1 - q) ** 2)
  }
  const s = clamp01(age / (tFall + tFire))
  const e = 1 - (1 - s) ** 2 // the sideways drift slows down too
  const d: V3 = [
    w.u0[0] * w.r0 + w.drift[0] * e,
    w.u0[1] * w.r0 + w.drift[1] * e,
    w.u0[2] * w.r0 + w.drift[2] * e,
  ]
  const n = Math.sqrt(dot(d, d)) || 1
  return { p: [(d[0] / n) * r, (d[1] / n) * r, (d[2] / n) * r], phase, q }
}
