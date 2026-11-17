import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import type { OrthographicCamera } from 'three'
import { CATCH_RADIUS, dist, EFFECT_LIFE, HUD_CLOSE, onOrbit, targetForecast, type GameState, type Iss } from '../sim'
import { renderTick, world } from '../state/world'
import { GLOW_MASK } from './glow'
import { hex } from './colors'
import { issAt, playerAt } from './interp'
import { Reticle } from './Reticle'
import { Ribbon } from './ribbon'
import { BARREL_RING, BARREL_RING_HIDDEN, EFFECT_COLORS, HEART_RING, HEART_RING_HIDDEN, RETICLE_ISS, RETICLE_ISS_HIDDEN, RING_AMBER, RING_AMBER_HIDDEN, RING_GREEN } from './style'

const SEGMENTS = 48
const POOL = 12 // flashes alive at once (a capture, a spawn and a burn-out fit easily)

/** Fills `xyz` with a circle of SEGMENTS + 1 points (the last repeats the first). */
function circle(xyz: Float32Array, cx: number, cy: number, r: number): void {
  for (let i = 0; i <= SEGMENTS; i++) {
    const a = (2 * Math.PI * i) / SEGMENTS
    xyz.set([cx + r * Math.cos(a), cy + r * Math.sin(a), 0], i * 3)
  }
}

/** The turtle's course leads straight into the target (the same test as the green MIS / ETA in the HUD). */
function onCourse(g: GameState, target: Iss): boolean {
  const { eta, miss } = targetForecast(g, target)
  return eta !== null && miss < CATCH_RADIUS
}

/** Drawn over everything: the dashed catch ring around the ISS and the ring flashes of
 *  captures, hits and new satellites. The flashes come from a fixed pool of ribbons. */
export function Overlay() {
  const camera = useThree((s) => s.camera) as OrthographicCamera
  const o = useMemo(() => {
    const rgba = new Float32Array((SEGMENTS + 1) * 4)
    return {
      ring: new Ribbon(SEGMENTS + 1, true),
      heartRing: new Ribbon(SEGMENTS + 1, true),
      barrelRing: new Ribbon(SEGMENTS + 1, true),
      issSight: new Reticle(),
      heartSight: new Reticle(),
      barrelSight: new Reticle(),
      flashes: Array.from({ length: POOL }, () => {
        const r = new Ribbon(SEGMENTS + 1, true)
        r.mesh.layers.mask = GLOW_MASK // a ring flash glows
        return r
      }),
      xyz: new Float32Array((SEGMENTS + 1) * 3),
      rgba,
    }
  }, [])
  const fill = (color: string, alpha: number): void => {
    const c = hex(color)
    for (let i = 0; i <= SEGMENTS; i++) o.rgba.set([c.r, c.g, c.b, alpha], i * 4)
  }

  useFrame(() => {
    const g = world.game
    const px = 1 / camera.zoom
    const sight = (r: Reticle, at: readonly [number, number, number], color: string, phase: number): void => {
      const ring = CATCH_RADIUS * (1 + 0.08 * Math.sin(renderTick() * 0.3 + phase)) // the dashed ring's own radius (same pulse)
      r.set(at[0], at[1], ring + px, renderTick() * 0.04 * (phase % 2 === 0 ? 1 : -1), color, 1, px)
    }
    if (!g.layers.game) {
      o.ring.mesh.visible = false
      o.heartRing.mesh.visible = false
      o.barrelRing.mesh.visible = false
      o.issSight.hide()
      o.heartSight.hide()
      o.barrelSight.hide()
      o.flashes.forEach((f) => (f.mesh.visible = false))
      return
    }
    if (g.layers.iss) {
      const ip = issAt(g, world.alpha)
      const close = dist(ip, playerAt(g, world.alpha).pos) < HUD_CLOSE * CATCH_RADIUS
      const r = CATCH_RADIUS * (1 + 0.08 * Math.sin(renderTick() * 0.3))
      circle(o.xyz, ip[0], ip[1], r)
      fill(close ? RING_GREEN : ip[2] >= 0 ? RING_AMBER : RING_AMBER_HIDDEN, 1)
      o.ring.set(SEGMENTS + 1, o.xyz, o.rgba, px, { on: 5 * px, period: 9 * px }, true)
      if (g.status === 'playing' && onCourse(g, g.iss)) sight(o.issSight, ip, ip[2] >= 0 ? RETICLE_ISS : RETICLE_ISS_HIDDEN, 0)
      else o.issSight.hide()
    } else {
      o.ring.mesh.visible = false
      o.issSight.hide()
    }

    const heart = g.heart
    if (heart) {
      const hp = onOrbit(heart.r, heart.u, heart.v, heart.theta + heart.omega * world.alpha)
      const r = CATCH_RADIUS * (1 + 0.08 * Math.sin(renderTick() * 0.3 + 1))
      circle(o.xyz, hp[0], hp[1], r)
      fill(hp[2] >= 0 ? HEART_RING : HEART_RING_HIDDEN, 1)
      o.heartRing.set(SEGMENTS + 1, o.xyz, o.rgba, px, { on: 5 * px, period: 9 * px }, true)
      if (g.status === 'playing' && onCourse(g, heart)) sight(o.heartSight, hp, hp[2] >= 0 ? HEART_RING : HEART_RING_HIDDEN, 1)
      else o.heartSight.hide()
    } else {
      o.heartRing.mesh.visible = false
      o.heartSight.hide()
    }

    const barrel = g.barrel
    if (barrel) {
      const bp = onOrbit(barrel.r, barrel.u, barrel.v, barrel.theta + barrel.omega * world.alpha)
      const r = CATCH_RADIUS * (1 + 0.08 * Math.sin(renderTick() * 0.3 + 2))
      circle(o.xyz, bp[0], bp[1], r)
      fill(bp[2] >= 0 ? BARREL_RING : BARREL_RING_HIDDEN, 1)
      o.barrelRing.set(SEGMENTS + 1, o.xyz, o.rgba, px, { on: 5 * px, period: 9 * px }, true)
      if (g.status === 'playing' && onCourse(g, barrel)) sight(o.barrelSight, bp, bp[2] >= 0 ? BARREL_RING : BARREL_RING_HIDDEN, 2)
      else o.barrelSight.hide()
    } else {
      o.barrelRing.mesh.visible = false
      o.barrelSight.hide()
    }

    o.flashes.forEach((ribbon, i) => {
      const e = g.effects[i]
      if (!e) {
        ribbon.mesh.visible = false
        return
      }
      const f = Math.min(1, (e.age + world.alpha) / EFFECT_LIFE)
      circle(o.xyz, e.x, e.y, (8 + 46 * f) / 250)
      fill(EFFECT_COLORS[e.kind], 1 - f)
      ribbon.set(SEGMENTS + 1, o.xyz, o.rgba, (Math.max(1, Math.round(4 * (1 - f))) / 2) * px, undefined, true)
    })
  })

  return (
    <>
      <primitive object={o.ring.mesh} />
      <primitive object={o.heartRing.mesh} />
      <primitive object={o.barrelRing.mesh} />
      {[o.issSight, o.heartSight, o.barrelSight].flatMap((r) => r.meshes).map((m) => (
        <primitive key={m.id} object={m} />
      ))}
      {o.flashes.map((f, i) => (
        <primitive key={i} object={f.mesh} />
      ))}
    </>
  )
}
