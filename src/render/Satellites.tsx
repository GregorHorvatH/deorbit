import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, type OrthographicCamera } from 'three'
import { activeSatellites, onOrbit, RADIUS_PX, SATELLITE_COUNT } from '../sim'
import { useSettings } from '../state/settings'
import { renderTick, world } from '../state/world'
import { shade } from './colors'
import { Ribbon } from './ribbon'
import { SAT_BODY, SAT_PANEL, SAT_TRAIL, SAT_TRAIL_COLOR, SAT_TRAIL_STEP } from './style'

const quad = new PlaneGeometry(1, 1)
const TRAIL_POINTS = SAT_TRAIL + 1

/** The ordinary satellites: a body with two solar panels and a fading trail. Pre-built once for all 10 orbits; the
 *  inactive ones are just hidden (no objects are created or destroyed while playing). */
export function Satellites() {
  const camera = useThree((s) => s.camera) as OrthographicCamera
  const sats = useMemo(
    () =>
      Array.from({ length: SATELLITE_COUNT }, () => {
        const panelMat = new MeshBasicMaterial()
        const bodyMat = new MeshBasicMaterial()
        const group = new Group()
        const panel = new Mesh(quad, panelMat)
        panel.scale.set(22, 3, 1)
        const body = new Mesh(quad, bodyMat)
        body.scale.set(5.6, 5.6, 1)
        body.position.z = 0.002 // px units inside the group; a hair in front of the panels
        group.add(panel, body)
        group.visible = false
        return { group, panelMat, bodyMat, ribbon: new Ribbon(TRAIL_POINTS) }
      }),
    [],
  )
  const scratch = useMemo(() => ({ xyz: new Float32Array(TRAIL_POINTS * 3), rgba: new Float32Array(TRAIL_POINTS * 4), c: new Color() }), [])

  useFrame(() => {
    const g = world.game
    const tick = renderTick()
    const n = g.layers.sats ? activeSatellites(g) : 0
    const px = 1 / camera.zoom
    const trails = useSettings.getState().quality < 2 // slow machine: no trails
    sats.forEach((s, i) => {
      s.group.visible = i < n
      if (i >= n) {
        s.ribbon.mesh.visible = false
        return
      }
      const { r, u, v, omega, phase } = g.orbits[i]
      const theta = phase + omega * tick
      const dir = omega > 0 ? 1 : -1
      for (let j = 0; j < TRAIL_POINTS; j++) {
        const [x, y, z] = onOrbit(r, u, v, theta - dir * j * SAT_TRAIL_STEP)
        scratch.xyz.set([x, y, z], j * 3)
        shade(scratch.c, SAT_TRAIL_COLOR, x)
        scratch.rgba.set([scratch.c.r, scratch.c.g, scratch.c.b, 0.9 * (1 - j / SAT_TRAIL)], j * 4)
      }
      if (trails) s.ribbon.set(TRAIL_POINTS, scratch.xyz, scratch.rgba, px) // 2 px wide
      else s.ribbon.mesh.visible = false
      const x = scratch.xyz[0], y = scratch.xyz[1], z = scratch.xyz[2]
      s.group.position.set(x, y, z)
      s.group.scale.setScalar((0.85 + (0.15 * z) / r) / RADIUS_PX) // closer to the viewer = slightly larger
      s.panelMat.color.copy(shade(scratch.c, SAT_PANEL, x))
      s.bodyMat.color.copy(shade(scratch.c, SAT_BODY, x))
    })
  })

  return (
    <>
      {sats.map((s, i) => (
        <group key={i}>
          <primitive object={s.ribbon.mesh} />
          <primitive object={s.group} />
        </group>
      ))}
    </>
  )
}

