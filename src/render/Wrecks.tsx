import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { CircleGeometry, Color, Group, Mesh, MeshBasicMaterial } from 'three'
import { length, RADIUS_PX, wreckState } from '../sim'
import { world } from '../state/world'
import { fireColor, hex } from './colors'
import { GLOW_MASK } from './glow'
import { makeStation } from './station'
import { BURN_COLORS, ISS_BODY, ISS_PANEL, ISS_SIZE, ISS_TRUSS } from './style'

const POOL = 4 // stations falling at once (a burn lasts under a second)
const disc = new CircleGeometry(1, 28)
const FIREBALL: ReadonlyArray<readonly [number, number]> = [[1.0, 3], [0.72, 2], [0.46, 1], [0.22, 0]] // [scale, BURN_COLORS index]

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** A caught station: it falls intact (turning orange as it nears the air), then burns inside ONE fireball that swells
 *  and shrinks while the station melts away. Pooled: nothing is created while playing. */
export function Wrecks() {
  const pool = useMemo(
    () =>
      Array.from({ length: POOL }, () => {
        const root = new Group()
        const balls = FIREBALL.map(([, ci], i) => {
          const m = new Mesh(disc, new MeshBasicMaterial({ color: hex(BURN_COLORS[ci]) }))
          m.position.z = 0.001 * i
          m.layers.mask = GLOW_MASK // the fireball glows
          root.add(m)
          return m
        })
        const st = makeStation()
        st.group.position.z = 0.02 // the station is drawn on top of its own fire
        root.add(st.group)
        root.visible = false
        return { root, balls, st }
      }),
    [],
  )
  const tmp = useMemo(() => new Color(), [])

  useFrame(() => {
    const g = world.game
    pool.forEach((slot, i) => {
      const w = g.wrecks[i]
      if (!w || !g.layers.game) {
        slot.root.visible = false
        return
      }
      const { p, phase, q } = wreckState(w, w.age + world.alpha)
      const [x, y, z] = p
      slot.root.visible = true
      slot.root.position.set(x, y, z)
      const depth = 0.85 + (0.15 * z) / length(p)
      let heat: number
      let shrink: number
      if (phase === 'fall') {
        heat = 0.5 * clamp01((q - 0.6) / 0.4) // warming up
        shrink = 1 - 0.2 * q * q // a little smaller as it drops away from us
        slot.balls.forEach((b) => (b.visible = false))
      } else {
        heat = 0.5 + 0.5 * q // glowing
        shrink = 0.8 * (1 - 0.9 * q * q) // melting away
        const rad = (5 + 20 * Math.sin(Math.PI * q) ** 0.7) * (1 + 0.07 * Math.sin((w.age + world.alpha) * 3))
        slot.balls.forEach((b, j) => {
          b.visible = true
          b.scale.setScalar((rad * FIREBALL[j][0]) / RADIUS_PX)
        })
      }
      slot.st.group.scale.setScalar((ISS_SIZE * depth * shrink) / RADIUS_PX)
      const burnt = fireColor(tmp, 0.3).clone()
      slot.st.truss.color.lerpColors(hex(ISS_TRUSS[0]), burnt, heat)
      slot.st.panel.color.lerpColors(hex(ISS_PANEL[0]), burnt, heat)
      slot.st.body.color.lerpColors(hex(ISS_BODY[0]), burnt, heat)
    })
  })

  return (
    <>
      {pool.map((s, i) => (
        <primitive key={i} object={s.root} />
      ))}
    </>
  )
}
