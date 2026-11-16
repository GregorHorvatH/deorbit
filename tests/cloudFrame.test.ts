import { Group, Mesh, Vector3 } from 'three'
import { describe, expect, test } from 'vitest'
import { cloudFrame } from '../src/render/cloudFrame'
import { CLOUD_DRIFT } from '../src/render/style'
import { SPEED, TILT } from '../src/sim'

/** The same hierarchy the scene uses: a tilted group, a spinning group inside it, the mesh inside that. */
function pose(spin: number): { root: Group; mesh: Mesh } {
  const root = new Group()
  root.rotation.x = TILT
  const turning = new Group()
  turning.rotation.y = spin
  const mesh = new Mesh()
  turning.add(mesh)
  root.add(turning)
  root.updateMatrixWorld(true)
  return { root, mesh }
}

describe('the cloud frame matches the real scene graph', () => {
  for (const tick of [0, 37.5, 400, 1234.5, 9000]) {
    const a = (tick * SPEED) % (2 * Math.PI)
    const c = (tick * SPEED * CLOUD_DRIFT) % (2 * Math.PI)
    const ground = pose(a)
    const cloud = pose(c)

    test(`tick ${tick}: the Sun is where the cloud group sees it`, () => {
      const f = cloudFrame(tick) // asked inside the test: the frame is one shared, cached object
      const sun = cloud.mesh.worldToLocal(new Vector3(1, 0, 0)) // the world is rotated in, so this is a direction
      expect(sun.distanceTo(f.sun)).toBeLessThan(1e-9)
    })

    test(`tick ${tick}: a point of the world lands on the same place in the cloud frame`, () => {
      const f = cloudFrame(tick)
      for (const w of [new Vector3(0.2, 0.4, 0.9), new Vector3(-0.8, 0.1, 0.5), new Vector3(0, -1, 0)]) {
        expect(cloud.mesh.worldToLocal(w.clone()).distanceTo(w.clone().applyMatrix3(f.worldToCloud))).toBeLessThan(1e-9)
      }
    })

    test(`tick ${tick}: a point of the ground lands on the same place in the cloud frame`, () => {
      const f = cloudFrame(tick)
      for (const p of [new Vector3(0.3, 0.5, 0.81).normalize(), new Vector3(-0.7, 0.1, 0.7).normalize(), new Vector3(0, 1, 0)]) {
        const world = ground.mesh.localToWorld(p.clone())
        const inCloud = cloud.mesh.worldToLocal(world)
        expect(inCloud.distanceTo(p.clone().applyMatrix3(f.toCloud))).toBeLessThan(1e-9)
      }
    })
  }
})
