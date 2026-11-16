import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { Color, type OrthographicCamera } from 'three'
import { onOrbit, RADIUS_PX } from '../sim'
import { renderTick, world } from '../state/world'
import { makeBarrel } from './barrelModel'
import { hex, shade } from './colors'
import { GLOW_MASK } from './glow'
import { Ribbon } from './ribbon'
import { BARREL_BAND, BARREL_BODY, BARREL_SIZE, BARREL_TRAIL, BARREL_TRAIL_COLOR, SAT_TRAIL_STEP } from './style'

const TRAIL_POINTS = BARREL_TRAIL + 1

/** The barrel of fuel on its orbit: a slowly tumbling drum with a short trail. Its dashed catch ring is drawn with the
 *  other rings (Overlay). */
export function Barrel() {
  const camera = useThree((s) => s.camera) as OrthographicCamera
  const b = useMemo(() => {
    const m = makeBarrel()
    m.group.visible = false
    m.group.children.forEach((c) => (c.layers.mask = GLOW_MASK)) // it glows a little
    return {
      ...m, ribbon: new Ribbon(TRAIL_POINTS), c: new Color(),
      xyz: new Float32Array(TRAIL_POINTS * 3), rgba: new Float32Array(TRAIL_POINTS * 4),
    }
  }, [])

  useFrame(() => {
    const g = world.game
    const barrel = g.barrel
    if (!barrel || !g.layers.game) {
      b.group.visible = false
      b.ribbon.mesh.visible = false
      return
    }
    const { r, u, v, omega } = barrel
    const theta = barrel.theta + omega * world.alpha
    const step = Math.min(SAT_TRAIL_STEP, omega * 6)
    const tc = hex(BARREL_TRAIL_COLOR)
    for (let j = 0; j < TRAIL_POINTS; j++) {
      b.xyz.set(onOrbit(r, u, v, theta - j * step), j * 3)
      b.rgba.set([tc.r, tc.g, tc.b, 0.8 * (1 - j / BARREL_TRAIL)], j * 4)
    }
    b.ribbon.set(TRAIL_POINTS, b.xyz, b.rgba, 1 / camera.zoom)
    const x = b.xyz[0], y = b.xyz[1], z = b.xyz[2]
    b.group.visible = true
    b.group.position.set(x, y, z)
    b.group.rotation.z = renderTick() * 0.04
    b.group.scale.setScalar((BARREL_SIZE * (0.85 + (0.15 * z) / r)) / RADIUS_PX)
    b.body.color.copy(shade(b.c, BARREL_BODY, x))
    b.band.color.copy(shade(b.c, BARREL_BAND, x))
  })

  return (
    <>
      <primitive object={b.ribbon.mesh} />
      <primitive object={b.group} />
    </>
  )
}
