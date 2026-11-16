import { create } from 'zustand'
import { createGame, hudSnapshot, mulberry32, type HudSnapshot } from '../sim'

/** A throttled snapshot of the instruments for the DOM HUD. The simulation is the source of truth; React only ever
 *  sees this copy, refreshed ~15 times a second (see HudBridge) - never per frame. */
export const useHud = create<HudSnapshot>(() => hudSnapshot(createGame(mulberry32(1))))

/** Window scale of the HUD (1 = the design size; it only shrinks in a window smaller than the standard one). */
export const useView = create<{ hudScale: number }>(() => ({ hudScale: 1 }))
