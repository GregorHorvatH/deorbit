import { Ribbon } from './ribbon'
import { hex } from './colors'

const SEGMENTS = 48
const TICKS = 4

/** An aiming reticle: a solid ring with four cross-hair ticks that cut through it, slowly turning. Built once (a ring
 *  ribbon and one two-point ribbon per tick), then moved and recoloured every frame without allocating. */
export class Reticle {
  readonly ring = new Ribbon(SEGMENTS + 1, true)
  readonly ticks = Array.from({ length: TICKS }, () => new Ribbon(2, true))
  private readonly ringXyz = new Float32Array((SEGMENTS + 1) * 3)
  private readonly ringRgba = new Float32Array((SEGMENTS + 1) * 4)
  private readonly tickXyz = new Float32Array(6)
  private readonly tickRgba = new Float32Array(8)

  readonly meshes = [this.ring.mesh, ...this.ticks.map((t) => t.mesh)]

  hide(): void {
    for (const m of this.meshes) m.visible = false
  }

  /** @param r ring radius, world units; @param spin rotation of the ticks, radians; @param halfWidth half the line width */
  set(cx: number, cy: number, r: number, spin: number, color: string, alpha: number, halfWidth: number): void {
    const c = hex(color)
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (2 * Math.PI * i) / SEGMENTS
      this.ringXyz.set([cx + r * Math.cos(a), cy + r * Math.sin(a), 0], i * 3)
      this.ringRgba.set([c.r, c.g, c.b, alpha], i * 4)
    }
    this.ring.set(SEGMENTS + 1, this.ringXyz, this.ringRgba, halfWidth, undefined, true)
    for (let k = 0; k < TICKS; k++) {
      const a = spin + (k * 2 * Math.PI) / TICKS
      const ca = Math.cos(a), sa = Math.sin(a)
      this.tickXyz.set([cx + 0.45 * r * ca, cy + 0.45 * r * sa, 0, cx + 1.3 * r * ca, cy + 1.3 * r * sa, 0])
      for (let j = 0; j < 2; j++) this.tickRgba.set([c.r, c.g, c.b, alpha], j * 4)
      this.ticks[k].set(2, this.tickXyz, this.tickRgba, halfWidth)
    }
  }
}
