import { create } from 'zustand'
import { createGame, hudSnapshot, mulberry32, type HudSnapshot } from '../sim'

/** A throttled snapshot of the instruments for the DOM HUD. The simulation is the source of truth; React only ever
 *  sees this copy, refreshed ~15 times a second (see HudBridge) - never per frame. */
export const useHud = create<HudSnapshot>(() => hudSnapshot(createGame(mulberry32(1))))

/** Window scale of the HUD (1 = the design size; it only shrinks in a window smaller than the standard one). */
export const useView = create<{
  hudScale: number
  /** touch screen: where the HUD and the status panel start (just under the row of buttons), px; null = no touch buttons */
  touchTop: number | null
  /** touch screen: the height at the bottom of the window that the arrow pad covers (0 = none), px */
  padReserve: number
  /** natural height of the ship-status panel (hull / fuel / orbit), px; the HUD plate is made as tall (0 = not measured yet) */
  statusHeight: number
  /** the lowest point of the globe with its glow, px from the top of the window (the hint sits between it and the keys) */
  globeBottom: number
}>(() => ({ hudScale: 1, touchTop: null, padReserve: 0, statusHeight: 0, globeBottom: 0 }))
