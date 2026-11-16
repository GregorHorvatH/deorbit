/** Orbits of the ordinary satellites and of the ISS. Position = r (cos t u + sin t v). */
import { ISS_INCLINATION, ISS_ORBIT, TILT } from './config'
import { SATELLITE_SEEDS } from './data/satellites'
import { cross, orbitBasis, unit, type V3 } from './vec'

export interface Orbit {
  /** radius, Earth radii */
  r: number
  u: V3
  v: V3
  /** radians per step (negative = retrograde) */
  omega: number
  phase: number
}

/** A fresh copy of the 10 satellite orbits (the game re-rolls their phases as they are activated). */
export function makeOrbits(): Orbit[] {
  return SATELLITE_SEEDS.map(({ radius, normal, omega, phase }) => {
    const n = unit(normal)
    const ref: V3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
    const u = unit(cross(n, ref))
    return { r: radius, u, v: cross(n, u), omega, phase }
  })
}

/** The ISS orbit: inclined by ISS_INCLINATION to Earth's rotation axis (taking the axial tilt into account). */
export function makeIssOrbit(): { r: number; u: V3; v: V3 } {
  const inc = (ISS_INCLINATION * Math.PI) / 180
  const n: V3 = [Math.sin(inc), Math.cos(inc) * Math.cos(TILT), Math.cos(inc) * Math.sin(TILT)]
  const [u, v] = orbitBasis(n)
  return { r: ISS_ORBIT, u, v }
}
