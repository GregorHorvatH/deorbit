import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

const quad = new PlaneGeometry(1, 1)

/** A barrel of fuel as plain shapes in DESIGN PIXEL units around (0, 0): a drum with two dark bands and a stripe. Scale the
 *  group by size / 250 to put it in the world. The two materials are exposed so the caller can colour them. */
export function makeBarrel(): { group: Group; body: MeshBasicMaterial; band: MeshBasicMaterial } {
  const body = new MeshBasicMaterial()
  const band = new MeshBasicMaterial()
  const group = new Group()
  const add = (mat: MeshBasicMaterial, cx: number, cy: number, w: number, h: number, z: number): void => {
    const m = new Mesh(quad, mat)
    m.position.set(cx, cy, z)
    m.scale.set(w, h, 1)
    group.add(m)
  }
  add(body, 0, 0, 6.4, 9, 0)
  add(band, 0, 3, 6.6, 1.4, 0.002)
  add(band, 0, -3, 6.6, 1.4, 0.002)
  add(band, 0, 0, 1.2, 9, 0.004)
  return { group, body, band }
}
