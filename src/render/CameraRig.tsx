import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import type { OrthographicCamera } from 'three'
import { RADIUS_PX } from '../sim'
import { useView } from '../state/hud'
import { computeView } from './layout'

/** A fixed orthographic camera looking down -z (a fixed, orthographic view). The zoom fits the globe and its glow
 *  in the window; the camera is shifted so the globe sits below the HUD. */
export function CameraRig({ game = true }: { game?: boolean }) {
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera) as OrthographicCamera
  useLayoutEffect(() => {
    const { zoom, dy } = computeView(size.width, size.height, game)
    camera.zoom = zoom
    camera.position.set(0, dy / zoom, 10) // the origin appears dy pixels below the screen centre
    camera.updateProjectionMatrix()
    useView.setState({ hudScale: Math.min(1, zoom / RADIUS_PX) }) // the HUD only shrinks, it never grows
  }, [size.width, size.height, game, camera])
  return null
}
