/** Where the clouds are, at large scale: a coarse equirectangular map of cloud fraction (0..1) that the cloud shader uses
 *  as its "weather": it decides how much of the sky is covered, and the shader adds the fine structure. The map can come
 *  from anywhere (an analytic climate guess, a baked snapshot, live weather): it is one small array. */
import { DataTexture, LinearFilter, RedFormat, RepeatWrapping, ClampToEdgeWrapping, UnsignedByteType } from 'three'

export const COVERAGE_W = 72 // 5 degrees
export const COVERAGE_H = 36

/** Mean cloud fraction by latitude (degrees), a rough climate: a wet belt at the equator, clear subtropical highs, the
 *  stormy mid-latitudes, and a cloudy far south. Row 0 of the map is the south pole. */
export function analyticCover(latDeg: number): number {
  const a = Math.abs(latDeg)
  const g = (x: number, c: number, w: number): number => Math.exp(-(((x - c) / w) ** 2))
  const itcz = 0.45 * g(latDeg, 5, 10) // the equatorial belt, a little north
  const storms = 0.5 * g(a, 55, 14) // the storm tracks
  const polar = 0.2 * g(a, 82, 8)
  const dry = 0.32 * g(a, 25, 9) // the subtropical highs: clear skies
  return Math.max(0, Math.min(1, 0.3 + itcz + storms + polar - dry))
}

/** The default map: the climate guess, the same in every longitude. */
export function analyticCoverage(): Uint8Array {
  const data = new Uint8Array(COVERAGE_W * COVERAGE_H)
  for (let j = 0; j < COVERAGE_H; j++) {
    const lat = -90 + ((j + 0.5) * 180) / COVERAGE_H
    data.fill(Math.round(analyticCover(lat) * 255), j * COVERAGE_W, (j + 1) * COVERAGE_W)
  }
  return data
}

/** A texture of the map. Longitude wraps around; the shader samples it with plain bilinear filtering. */
export function makeCoverageTexture(data: Uint8Array = analyticCoverage()): DataTexture {
  const tex = new DataTexture(data, COVERAGE_W, COVERAGE_H, RedFormat, UnsignedByteType)
  tex.magFilter = tex.minFilter = LinearFilter
  tex.wrapS = RepeatWrapping
  tex.wrapT = ClampToEdgeWrapping
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/** Seconds a new weather map takes to take over: the clouds grow, shrink and dissolve where they are instead of being
 *  redrawn (the shape of a cloud is a fixed noise cut at the local cover, so moving the cover morphs the cloud). */
export const MORPH_SECONDS = 40
/** The first real data after the start-up (or a switch to the climate guess) takes over quickly. */
export const FIRST_MORPH_SECONDS = 4

/** Moves the weather map smoothly from where it is now to a new target. `data` is the live buffer (the texture's). */
export class CoverageBlender {
  readonly data: Uint8Array
  private from: Uint8Array
  private to: Uint8Array
  private t0 = 0
  private dur = 0
  private active = false

  constructor(initial: Uint8Array) {
    this.data = Uint8Array.from(initial)
    this.from = Uint8Array.from(initial)
    this.to = Uint8Array.from(initial)
  }

  /** Starts moving to `target` over `seconds`, from wherever the map is right now (a new target in mid-move is fine). */
  set(target: Uint8Array, seconds: number, now: number): void {
    this.from = Uint8Array.from(this.data)
    this.to = Uint8Array.from(target)
    this.t0 = now
    this.dur = seconds
    this.active = true
    this.step(now)
  }

  /** Advances to time `now` (seconds); true when the data changed. */
  step(now: number): boolean {
    if (!this.active) return false
    const t = this.dur > 0 ? Math.max(0, Math.min(1, (now - this.t0) / this.dur)) : 1
    const e = t * t * (3 - 2 * t) // ease in and out
    for (let i = 0; i < this.data.length; i++) this.data[i] = Math.round(this.from[i] + (this.to[i] - this.from[i]) * e)
    if (t >= 1) this.active = false
    return true
  }

  get moving(): boolean {
    return this.active
  }
}
