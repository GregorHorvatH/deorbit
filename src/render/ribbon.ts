import { BufferAttribute, BufferGeometry, DoubleSide, DynamicDrawUsage, Mesh, ShaderMaterial } from 'three'

const vert = /* glsl */ `
attribute vec4 aColor;
attribute float aDist;
varying vec4 vColor;
varying float vDist;
void main() {
  vColor = aColor;
  vDist = aDist;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const frag = /* glsl */ `
uniform float uDashOn;
uniform float uDashPeriod; // 0 = a solid line
varying vec4 vColor;
varying float vDist;
void main() {
  if (uDashPeriod > 0.0 && mod(vDist, uDashPeriod) > uDashOn) discard;
  gl_FragColor = vColor;
}`

export interface Dash {
  on: number
  period: number
}

/** A thick polyline with per-vertex RGBA colour, optionally dashed. WebGL lines are always 1 px wide; the design
 *  wants 2 px, so lines are drawn as ribbons in the screen plane (the camera never turns). Geometry is allocated once
 *  and rewritten in place every frame, so a ribbon costs no garbage. Points are world (x, y, z); depth testing
 *  against the globe uses their z. */
export class Ribbon {
  readonly mesh: Mesh
  private readonly geo = new BufferGeometry()
  private readonly pos: Float32Array
  private readonly col: Float32Array
  private readonly dist: Float32Array
  private readonly mat: ShaderMaterial
  private readonly maxPoints: number

  /** @param onTop draw over everything (no depth test), like an overlay */
  constructor(maxPoints: number, onTop = false) {
    this.maxPoints = maxPoints
    this.pos = new Float32Array(maxPoints * 6)
    this.col = new Float32Array(maxPoints * 8)
    this.dist = new Float32Array(maxPoints * 2)
    const index = new Uint16Array((maxPoints - 1) * 6)
    for (let i = 0; i < maxPoints - 1; i++) index.set([2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2], i * 6)
    const attr = (a: Float32Array, n: number): BufferAttribute => new BufferAttribute(a, n).setUsage(DynamicDrawUsage)
    this.geo.setAttribute('position', attr(this.pos, 3))
    this.geo.setAttribute('aColor', attr(this.col, 4))
    this.geo.setAttribute('aDist', attr(this.dist, 1))
    this.geo.setIndex(new BufferAttribute(index, 1))
    this.mat = new ShaderMaterial({
      uniforms: { uDashOn: { value: 0 }, uDashPeriod: { value: 0 } },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      depthTest: !onTop,
      side: DoubleSide,
    })
    this.mesh = new Mesh(this.geo, this.mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = onTop ? 10 : 2
    this.mesh.visible = false
  }

  /** @param n number of points (at most maxPoints); xyz: 3 numbers per point, rgba: 4 per point
   *  @param halfWidth half the line width, world units
   *  @param closed the last point repeats the first: smooth the seam */
  set(n: number, xyz: ArrayLike<number>, rgba: ArrayLike<number>, halfWidth: number, dash?: Dash, closed = false): void {
    if (n < 2) {
      this.mesh.visible = false
      return
    }
    n = Math.min(n, this.maxPoints)
    this.mesh.visible = true
    let run = 0
    for (let i = 0; i < n; i++) {
      const p = closed && i === 0 ? n - 2 : Math.max(i - 1, 0)
      const q = closed && i === n - 1 ? 1 : Math.min(i + 1, n - 1)
      let dx = xyz[3 * q] - xyz[3 * p]
      let dy = xyz[3 * q + 1] - xyz[3 * p + 1]
      const len = Math.hypot(dx, dy)
      if (len < 1e-9) {
        dx = 1
        dy = 0
      } else {
        dx /= len
        dy /= len
      }
      const x = xyz[3 * i], y = xyz[3 * i + 1], z = xyz[3 * i + 2]
      const nx = -dy * halfWidth, ny = dx * halfWidth
      this.pos.set([x + nx, y + ny, z, x - nx, y - ny, z], i * 6)
      this.col.set([rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2], rgba[4 * i + 3]], i * 8)
      this.col.set([rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2], rgba[4 * i + 3]], i * 8 + 4)
      if (i > 0) run += Math.hypot(x - xyz[3 * (i - 1)], y - xyz[3 * (i - 1) + 1])
      this.dist[2 * i] = this.dist[2 * i + 1] = run
    }
    this.geo.setDrawRange(0, (n - 1) * 6)
    for (const name of ['position', 'aColor', 'aDist']) this.geo.getAttribute(name).needsUpdate = true
    this.mat.uniforms.uDashOn.value = dash ? dash.on : 0
    this.mat.uniforms.uDashPeriod.value = dash ? dash.period : 0
  }
}
