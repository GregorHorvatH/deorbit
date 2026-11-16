import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  BufferGeometry, Color, Float32BufferAttribute, LineBasicMaterial, LineLoop, Mesh, MeshBasicMaterial, type OrthographicCamera,
  Shape, ShapeGeometry, Vector2,
} from 'three'
import { PLAYER_PATH, RADIUS_PX, WOBBLE_LIFE } from '../sim'
import { renderTick, world } from '../state/world'
import { hex, shade } from './colors'
import { playerAt } from './interp'
import { Ribbon } from './ribbon'
import {
  PLAYER_COLOR, PLAYER_EDGE, PLAYER_HIDDEN_OUTLINE, PLAYER_PREDICTION, PLAYER_SIZE, PLAYER_TRAIL, TURTLE_SHAPE,
} from './style'

const TRAIL_POINTS = 13 // 12 segments, 0.05 rad apart
const PREDICT_POINTS = 23 // 22 segments over PLAYER_PATH

/** The turtle (the outline of turtle.shape("turtle")), the solid trail behind it and the dotted orbit ahead of it.
 *  While it is behind the Earth a dim outline is drawn over the globe so you never lose it. */
export function Turtle() {
  const camera = useThree((s) => s.camera) as OrthographicCamera
  const head = useRef<[number, number]>([1, 0]) // last good on-screen heading (while moving along the view axis)
  const obj = useMemo(() => {
    const shape = new Shape(TURTLE_SHAPE.map(([x, y]) => new Vector2(x, y)))
    const fillMat = new MeshBasicMaterial({ side: 2 })
    const fill = new Mesh(new ShapeGeometry(shape), fillMat)
    const outline = (mat: LineBasicMaterial): LineLoop => {
      const g = new BufferGeometry()
      g.setAttribute('position', new Float32BufferAttribute(TURTLE_SHAPE.flatMap(([x, y]) => [x, y, 0]), 3))
      return new LineLoop(g, mat)
    }
    const edgeMat = new LineBasicMaterial()
    const edge = outline(edgeMat)
    const ghostMat = new LineBasicMaterial({ color: hex(PLAYER_HIDDEN_OUTLINE), depthTest: false })
    const ghost = outline(ghostMat)
    ghost.renderOrder = 9
    fill.add(edge, ghost) // they share the turtle's position, heading and size
    fill.visible = false
    return {
      root: fill, fillMat, edgeMat, edge, ghost,
      trail: new Ribbon(TRAIL_POINTS),
      predict: new Ribbon(PREDICT_POINTS),
      c: new Color(),
      trailXyz: new Float32Array(TRAIL_POINTS * 3), trailRgba: new Float32Array(TRAIL_POINTS * 4),
      predXyz: new Float32Array(PREDICT_POINTS * 3), predRgba: new Float32Array(PREDICT_POINTS * 4),
    }
  }, [])

  useFrame(() => {
    const g = world.game
    const on = g.layers.game
    obj.root.visible = on
    if (!on) {
      obj.trail.mesh.visible = obj.predict.mesh.visible = false
      return
    }
    const pl = g.player
    const { pos, p, t } = playerAt(g, world.alpha)
    const [x, y, z] = pos
    const px = 1 / camera.zoom

    // trail behind: darkens on the night side, piece by piece
    for (let j = 0; j < TRAIL_POINTS; j++) {
      const a = -j * 0.05
      const c = Math.cos(a), s = Math.sin(a)
      const tx = pl.alt * (p[0] * c + t[0] * s)
      obj.trailXyz.set([tx, pl.alt * (p[1] * c + t[1] * s), pl.alt * (p[2] * c + t[2] * s)], j * 3)
      shade(obj.c, PLAYER_TRAIL, tx)
      obj.trailRgba.set([obj.c.r, obj.c.g, obj.c.b, 1], j * 4)
    }
    obj.trail.set(TRAIL_POINTS, obj.trailXyz, obj.trailRgba, px)

    // where this orbit leads: dotted, and bright on purpose (the planning aid)
    const pc = hex(PLAYER_PREDICTION)
    for (let j = 0; j < PREDICT_POINTS; j++) {
      const a = (j * PLAYER_PATH) / (PREDICT_POINTS - 1)
      const c = Math.cos(a), s = Math.sin(a)
      obj.predXyz.set([pl.alt * (p[0] * c + t[0] * s), pl.alt * (p[1] * c + t[1] * s), pl.alt * (p[2] * c + t[2] * s)], j * 3)
      obj.predRgba.set([pc.r, pc.g, pc.b, 1], j * 4)
    }
    obj.predict.set(PREDICT_POINTS, obj.predXyz, obj.predRgba, 0.5 * px, { on: 2 * px, period: 7 * px })

    // heading: the screen direction of the velocity (kept while it points at / away from the viewer)
    const n = Math.hypot(t[0], t[1])
    if (n > 0.05) head.current = [t[0] / n, t[1] / n]
    let [e0, e1] = head.current
    if (pl.wobble > 0) {
      // tumbling after a hit
      const a = 1.1 * Math.sin(pl.wobble * 0.8) * (pl.wobble / WOBBLE_LIFE)
      ;[e0, e1] = [e0 * Math.cos(a) - e1 * Math.sin(a), e0 * Math.sin(a) + e1 * Math.cos(a)]
    }
    obj.root.position.set(x, y, z)
    obj.root.rotation.z = Math.atan2(-e0, e1) // the nose (0, +16) -> the heading
    obj.root.scale.setScalar((PLAYER_SIZE * (0.9 + (0.1 * z) / pl.alt)) / RADIUS_PX)

    const blink = pl.hit > 0 && Math.floor(renderTick() / 3) % 2 === 0
    const behind = z < 0
    obj.fillMat.color.copy(shade(obj.c, PLAYER_COLOR, x))
    obj.edgeMat.color.copy(shade(obj.c, PLAYER_EDGE, x))
    obj.edge.visible = !blink
    obj.fillMat.visible = !blink
    obj.ghost.visible = behind
  })

  return (
    <>
      <primitive object={obj.trail.mesh} />
      <primitive object={obj.predict.mesh} />
      <primitive object={obj.root} />
    </>
  )
}
