import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { Color, type OrthographicCamera } from 'three'
import { onOrbit, RADIUS_PX } from '../sim'
import { world } from '../state/world'
import { hex, shade } from './colors'
import { Ribbon } from './ribbon'
import { makeStation } from './station'
import { ISS_BODY, ISS_PANEL, ISS_SIZE, ISS_TRAIL, ISS_TRAIL_COLOR, ISS_TRUSS, SAT_TRAIL_STEP } from './style'

const TRAIL_POINTS = ISS_TRAIL + 1

/** The station: truss, four solar arrays and two modules plus a fading trail. */
export function Iss() {
  const camera = useThree((s) => s.camera) as OrthographicCamera
  const iss = useMemo(() => {
    const st = makeStation()
    st.group.visible = false
    return { group: st.group, trussMat: st.truss, panelMat: st.panel, bodyMat: st.body, ribbon: new Ribbon(TRAIL_POINTS) }
  }, [])
  const scratch = useMemo(() => ({ xyz: new Float32Array(TRAIL_POINTS * 3), rgba: new Float32Array(TRAIL_POINTS * 4), c: new Color() }), [])

  useFrame(() => {
    const g = world.game
    const on = g.layers.iss
    iss.group.visible = on
    if (!on) {
      iss.ribbon.mesh.visible = false
      return
    }
    const { r, u, v, omega } = g.iss
    const theta = g.iss.theta + omega * world.alpha
    const step = Math.min(SAT_TRAIL_STEP, omega * 6) // a station that hardly moves has hardly any trail
    const tc = hex(ISS_TRAIL_COLOR)
    for (let j = 0; j < TRAIL_POINTS; j++) {
      scratch.xyz.set(onOrbit(r, u, v, theta - j * step), j * 3)
      scratch.rgba.set([tc.r, tc.g, tc.b, 0.9 * (1 - j / ISS_TRAIL)], j * 4)
    }
    iss.ribbon.set(TRAIL_POINTS, scratch.xyz, scratch.rgba, 1 / camera.zoom)
    const x = scratch.xyz[0], y = scratch.xyz[1], z = scratch.xyz[2]
    iss.group.position.set(x, y, z)
    iss.group.scale.setScalar((ISS_SIZE * (0.85 + (0.15 * z) / r)) / RADIUS_PX)
    iss.trussMat.color.copy(shade(scratch.c, ISS_TRUSS, x))
    iss.panelMat.color.copy(shade(scratch.c, ISS_PANEL, x))
    iss.bodyMat.color.copy(shade(scratch.c, ISS_BODY, x))
  })

  return (
    <>
      <primitive object={iss.ribbon.mesh} />
      <primitive object={iss.group} />
    </>
  )
}
