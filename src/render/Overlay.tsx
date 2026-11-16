import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import type { OrthographicCamera } from 'three'
import { CATCH_RADIUS, dist, EFFECT_LIFE, HUD_CLOSE } from '../sim'
import { renderTick, world } from '../state/world'
import { GLOW_MASK } from './glow'
import { hex } from './colors'
import { issAt, playerAt } from './interp'
import { Ribbon } from './ribbon'
import { EFFECT_COLORS, RING_AMBER, RING_AMBER_HIDDEN, RING_GREEN } from './style'

const SEGMENTS = 48
const POOL = 12 // flashes alive at once (a capture, a spawn and a burn-out fit easily)

/** Fills `xyz` with a circle of SEGMENTS + 1 points (the last repeats the first). */
function circle(xyz: Float32Array, cx: number, cy: number, r: number): void {
  for (let i = 0; i <= SEGMENTS; i++) {
    const a = (2 * Math.PI * i) / SEGMENTS
    xyz.set([cx + r * Math.cos(a), cy + r * Math.sin(a), 0], i * 3)
  }
}

/** Drawn over everything: the dashed catch ring around the ISS and the ring flashes of
 *  captures, hits and new satellites. The flashes come from a fixed pool of ribbons. */
export function Overlay() {
  const camera = useThree((s) => s.camera) as OrthographicCamera
  const o = useMemo(() => {
    const rgba = new Float32Array((SEGMENTS + 1) * 4)
    return {
      ring: new Ribbon(SEGMENTS + 1, true),
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
    if (!g.layers.game) {
      o.ring.mesh.visible = false
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
    } else o.ring.mesh.visible = false

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
      {o.flashes.map((f, i) => (
        <primitive key={i} object={f.mesh} />
      ))}
    </>
  )
}
