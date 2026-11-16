/** How the cloud layer sits relative to the ground and the Sun, for the shaders. Both turn about the (tilted) polar axis;
 *  the clouds a little faster. Writing the world transform of the ground as Rx(tilt) Ry(a) and of the clouds as
 *  Rx(tilt) Ry(c), a point `p` of the ground frame is at Ry(a - c) p in the cloud frame, and the Sun (which stands still
 *  on the +x axis of the world) is at Ry(-c)(1, 0, 0) in the cloud frame. Cached per tick: the cloud shell and the globe
 *  both ask for it every frame. */
import { Matrix3, Matrix4, Vector3 } from 'three'
import { SPEED, TILT } from '../sim'
import { CLOUD_DRIFT } from './style'

export interface CloudFrame {
  /** ground frame -> cloud frame */
  toCloud: Matrix3
  /** cloud frame -> ground frame (the weather map is fixed to the ground) */
  toGround: Matrix3
  /** the world -> the cloud frame (to find the cloud that a point on the screen looks at) */
  worldToCloud: Matrix3
  /** the direction of the Sun in the cloud frame (unit) */
  sun: Vector3
}

const frame: CloudFrame = { toCloud: new Matrix3(), toGround: new Matrix3(), worldToCloud: new Matrix3(), sun: new Vector3(1, 0, 0) }
const m4 = new Matrix4()
const tilt = new Matrix4()
let lastTick = NaN

export function cloudFrame(tick: number): CloudFrame {
  if (tick === lastTick) return frame
  lastTick = tick
  const ground = (tick * SPEED) % (2 * Math.PI)
  const cloud = (tick * SPEED * CLOUD_DRIFT) % (2 * Math.PI)
  frame.toCloud.setFromMatrix4(m4.makeRotationY(ground - cloud))
  frame.toGround.setFromMatrix4(m4.makeRotationY(cloud - ground))
  frame.worldToCloud.setFromMatrix4(m4.makeRotationY(-cloud).multiply(tilt.makeRotationX(-TILT))) // Qc^-1 = Ry(-c) Rx(-tilt)
  frame.sun.set(1, 0, 0).applyMatrix4(m4.makeRotationY(-cloud))
  return frame
}
