import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { Color, Mesh, MeshBasicMaterial, ShapeGeometry, type OrthographicCamera } from 'three'
import { onOrbit, RADIUS_PX } from '../sim'
import { renderTick, world } from '../state/world'
import { hex, shade } from './colors'
import { GLOW_MASK } from './glow'
import { heartShape } from './heartShape'
import { Ribbon } from './ribbon'
import { HEART_COLORS, HEART_SIZE, HEART_TRAIL, SAT_TRAIL_STEP } from './style'

const TRAIL_POINTS = HEART_TRAIL + 1

/** The heart on its orbit (the extra hull point to catch): a pulsing heart with a short trail. Its dashed catch ring is
 *  drawn with the other rings (Overlay). */
export function Heart() {
  const camera = useThree((s) => s.camera) as OrthographicCamera
  const h = useMemo(() => {
    const mat = new MeshBasicMaterial()
    const mesh = new Mesh(new ShapeGeometry(heartShape()), mat)
    mesh.layers.mask = GLOW_MASK // it glows
    mesh.visible = false
    return {
      mesh, mat, ribbon: new Ribbon(TRAIL_POINTS), c: new Color(),
      xyz: new Float32Array(TRAIL_POINTS * 3), rgba: new Float32Array(TRAIL_POINTS * 4),
    }
  }, [])

  useFrame(() => {
    const g = world.game
    const heart = g.heart
    if (!heart || !g.layers.game) {
      h.mesh.visible = false
      h.ribbon.mesh.visible = false
      return
    }
    const { r, u, v, omega } = heart
    const theta = heart.theta + omega * world.alpha
    const step = Math.min(SAT_TRAIL_STEP, omega * 6)
    const tc = hex(HEART_COLORS[0])
    for (let j = 0; j < TRAIL_POINTS; j++) {
      h.xyz.set(onOrbit(r, u, v, theta - j * step), j * 3)
      h.rgba.set([tc.r, tc.g, tc.b, 0.8 * (1 - j / HEART_TRAIL)], j * 4)
    }
    h.ribbon.set(TRAIL_POINTS, h.xyz, h.rgba, 1 / camera.zoom)
    const x = h.xyz[0], y = h.xyz[1], z = h.xyz[2]
    const beat = 1 + 0.18 * Math.sin(renderTick() * 0.3)
    h.mesh.visible = true
    h.mesh.position.set(x, y, z)
    h.mesh.scale.setScalar((HEART_SIZE * beat * (0.85 + (0.15 * z) / r)) / RADIUS_PX)
    h.mat.color.copy(shade(h.c, HEART_COLORS, x))
  })

  return (
    <>
      <primitive object={h.ribbon.mesh} />
      <primitive object={h.mesh} />
    </>
  )
}
