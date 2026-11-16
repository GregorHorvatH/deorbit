import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

const quad = new PlaneGeometry(1, 1)

/** The station as plain shapes, in DESIGN PIXEL units around (0, 0): scale the group
 *  by size / 250 to put it in the world. Truss, four solar arrays, two modules; the three materials are exposed so
 *  the caller can colour them. */
export function makeStation(): { group: Group; truss: MeshBasicMaterial; panel: MeshBasicMaterial; body: MeshBasicMaterial } {
  const truss = new MeshBasicMaterial()
  const panel = new MeshBasicMaterial()
  const body = new MeshBasicMaterial()
  const group = new Group()
  const add = (mat: MeshBasicMaterial, cx: number, cy: number, w: number, h: number, z: number): void => {
    const m = new Mesh(quad, mat)
    m.position.set(cx, cy, z)
    m.scale.set(w, h, 1)
    group.add(m)
  }
  add(truss, 0, 0, 20, 2, 0)
  for (const side of [-1, 1]) for (const half of [-1, 1]) add(panel, side * 10, half * 5.2, 4.4, 8, 0.002)
  add(body, 0, 0, 3.6, 9, 0.004)
  add(body, 0, 0, 8, 2.4, 0.004)
  return { group, truss, panel, body }
}
