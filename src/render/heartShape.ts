import { Shape } from 'three'

/** A heart about 2 units wide and 2 high around (0, 0), the point down. Scale it to put it in the world. */
export function heartShape(): Shape {
  const s = new Shape()
  s.moveTo(0, -1)
  s.bezierCurveTo(-0.2, -0.8, -1, -0.2, -1, 0.3)
  s.bezierCurveTo(-1, 0.8, -0.4, 1, 0, 0.55)
  s.bezierCurveTo(0.4, 1, 1, 0.8, 1, 0.3)
  s.bezierCurveTo(1, -0.2, 0.2, -0.8, 0, -1)
  return s
}
