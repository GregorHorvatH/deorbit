/** The ETA / MIS instruments: if nothing changes, where do the turtle and the ISS go?
 *  Scalar code without allocations in the inner loop. */
import { CATCH_RADIUS, FORECAST_SECONDS, TICK_MS } from './config'
import { turtleSpeed } from './levels'
import type { GameState } from './types'
import { cross, dot, mul, sub, unit, type V3 } from './vec'
import { onOrbit } from './vec'

export interface Forecast {
  /** seconds until the closest pass; null when the two only move apart from now on */
  eta: number | null
  /** distance at that moment, Earth radii */
  miss: number
}

/** Both objects keep flying their current orbits for FORECAST_SECONDS. Returns the closest pass; if the turtle would
 *  catch the ISS (come within CATCH_RADIUS) it reports the FIRST such pass, not a later closer one. */
export function interceptForecast(g: GameState): Forecast {
  const { p, t, alt: rt } = g.player
  const wt = turtleSpeed(rt)
  const { omega: wi, r: ri, u, v, theta: th } = g.iss

  const gap = (tau: number): number => {
    const c = Math.cos(wt * tau)
    const s = Math.sin(wt * tau)
    const cb = Math.cos(th + wi * tau)
    const sb = Math.sin(th + wi * tau)
    const dx = rt * (p[0] * c + t[0] * s) - ri * (u[0] * cb + v[0] * sb)
    const dy = rt * (p[1] * c + t[1] * s) - ri * (u[1] * cb + v[1] * sb)
    const dz = rt * (p[2] * c + t[2] * s) - ri * (u[2] * cb + v[2] * sb)
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  const horizon = (FORECAST_SECONDS * 1000) / TICK_MS
  const coarse = 4 // a coarse scan: every 4 steps = 0.1 s
  const n = Math.floor(horizon / coarse) + 1
  const samples = new Float64Array(n)
  for (let i = 0; i < n; i++) samples[i] = gap(i * coarse)

  let bestTau = 0
  let best = samples[0]
  let firstCatch: [number, number] | null = null
  for (let i = 0; i < n; i++) {
    const d = samples[i]
    // a close pass is sharp, so a coarse sample can miss its bottom: refine around EVERY local minimum
    const left = i > 0 ? samples[i - 1] : Infinity
    const right = i + 1 < n ? samples[i + 1] : Infinity
    if (d <= left && d <= right) {
      const lo = Math.max(0, (i - 1) * coarse)
      const hi = Math.min(horizon, (i + 1) * coarse) // never look beyond the horizon
      let passTau = lo
      let passMin = Infinity
      for (let j = 0; j < 33; j++) {
        const tau = lo + (j * (hi - lo)) / 32
        const dd = gap(tau)
        if (dd < passMin) {
          passTau = tau
          passMin = dd
        }
      }
      if (passMin < best) {
        bestTau = passTau
        best = passMin
      }
      if (firstCatch === null && passMin < CATCH_RADIUS) firstCatch = [passTau, passMin]
    }
  }
  // If the first pass already catches the ISS, that is the one that matters (the ISS disappears when caught).
  if (firstCatch !== null) [bestTau, best] = firstCatch
  return { eta: bestTau > 0 ? (bestTau * TICK_MS) / 1000 : null, miss: best }
}

/** Where the ISS is relative to the turtle's heading, degrees: > 0 left, < 0 right, 0 dead ahead, 180 behind
 *  (measured in the tangent plane at the turtle). */
export function issBearing(g: GameState): number {
  const { p, t } = g.player
  const iss = g.iss
  const iu = unit(onOrbit(iss.r, iss.u, iss.v, iss.theta))
  const d0 = sub(iu, mul(p, dot(iu, p)))
  if (dot(d0, d0) < 1e-12) return 0
  const d: V3 = unit(d0)
  return (Math.atan2(dot(cross(p, t), d), dot(t, d)) * 180) / Math.PI
}
