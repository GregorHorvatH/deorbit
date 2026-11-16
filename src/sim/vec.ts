/** Tiny 3-vector helpers on plain tuples (the simulation does not depend on three.js). */

export type V3 = readonly [number, number, number]

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const length = (a: V3): number => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2])
export const unit = (a: V3): V3 => {
  const n = length(a)
  return [a[0] / n, a[1] / n, a[2] / n]
}
export const dist = (a: V3, b: V3): number =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Two perpendicular unit vectors spanning the plane with normal n: position = r * (cos a * u + sin a * v). */
export function orbitBasis(n: V3): [V3, V3] {
  const nn = unit(n)
  const ref: V3 = Math.abs(nn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const u = unit(cross(nn, ref))
  return [u, cross(nn, u)]
}

/** A point on the circle r * (cos a * u + sin a * v). */
export function onOrbit(r: number, u: V3, v: V3, angle: number): V3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [r * (c * u[0] + s * v[0]), r * (c * u[1] + s * v[1]), r * (c * u[2] + s * v[2])]
}
