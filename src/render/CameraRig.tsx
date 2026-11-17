import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import type { OrthographicCamera } from 'three'
import { ATMO_WIDTH, RADIUS_PX } from '../sim'
import { useView } from '../state/hud'
import { computeView, HUD_MARGIN, hudHeight } from './layout'

/** A fixed orthographic camera looking down -z (a fixed, orthographic view). The zoom fits the globe and its glow
 *  in the window; the camera is shifted so the globe sits below the HUD. */
export function CameraRig({ game = true }: { game?: boolean }) {
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera) as OrthographicCamera
  const touchTop = useView((s) => s.touchTop)
  const padReserve = useView((s) => s.padReserve)
  const statusHeight = useView((s) => s.statusHeight)
  useLayoutEffect(() => {
    const margin = touchTop ?? HUD_MARGIN // on a phone the HUD starts under the row of buttons
    const reserve = size.height > size.width ? padReserve : 0 // a portrait phone keeps the globe clear of the arrow pad
    const { zoom, dy } = computeView(
      size.width, size.height, game,
      // on a phone the HUD plate is as tall as the status panel on the left (when that is taller)
      touchTop === null ? undefined : (k) => Math.max(hudHeight(k), statusHeight),
      margin, reserve,
    )
    camera.zoom = zoom
    camera.position.set(0, dy / zoom, 10) // the origin appears dy pixels below the screen centre
    camera.updateProjectionMatrix()
    useView.setState({ hudScale: Math.min(1, zoom / RADIUS_PX), globeBottom: size.height / 2 + dy + (1 + ATMO_WIDTH) * zoom }) // the HUD only shrinks, it never grows
  }, [size.width, size.height, game, camera, touchTop, padReserve, statusHeight])
  return null
}
