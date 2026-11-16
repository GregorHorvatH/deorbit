/** Where the globe goes in the window. Pure maths. */
import { ATMO_WIDTH, RADIUS_PX } from '../sim'

/** The window the game was designed in is 700 px wide: its scale k = 1. */
export const BASE_SIZE = 700
export const GLOBE_GAP = 24 // minimum free pixels between the globe and the HUD plate above it / the window edge below it
export const HUD_MARGIN = 32
/** Height of the HUD plate at scale 1 (title + info + header + two rows + padding). The DOM HUD will report the real one. */
export const HUD_PLATE_HEIGHT = 111

export interface View {
  /** pixels per Earth radius */
  zoom: number
  /** pixels the globe's centre sits BELOW the canvas centre */
  dy: number
}

const hudHeight = (k: number): number => Math.round(HUD_PLATE_HEIGHT * Math.min(k, 1)) // the HUD never grows

/** The scale and the shift for a w x h window. With the game on, the globe (with its glow) fits in the space below the
 *  HUD plate with GLOBE_GAP free on both sides, and is centred between the plate and the bottom edge; with the game off
 *  it is simply centred. */
export function computeView(w: number, h: number, gameOn: boolean, plateHeight = hudHeight): View {
  let k = Math.min(w, h) / BASE_SIZE
  const outer = 1 + ATMO_WIDTH // globe + glow, Earth radii
  if (gameOn) {
    for (let i = 0; i < 2; i++) {
      const room = h - HUD_MARGIN - plateHeight(k) - 2 * GLOBE_GAP
      k = Math.min(k, room / (2 * outer * RADIUS_PX))
    }
    k = Math.max(k, 0.2)
  }
  if (Math.abs(k - 1) < 0.05) k = 1
  const zoom = k * RADIUS_PX
  if (!gameOn) return { zoom, dy: 0 }
  const centre = (HUD_MARGIN + plateHeight(k)) / 2 // between the plate's bottom and the window's bottom edge
  const lowest = h / 2 - outer * zoom - 2 // never so low that the glow is cut off
  return { zoom, dy: Math.round(Math.min(centre, lowest)) }
}
