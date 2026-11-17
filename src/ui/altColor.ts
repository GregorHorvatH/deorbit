import { HUD_ALT_NEAR } from '../sim'

/** The colour of an ALT value, shared by the HUD table and the labels next to the flying objects: green = the same
 *  altitude level as the other orbit, amber = 1..HUD_ALT_NEAR levels apart, plain text otherwise. */
export function altColor(levelsOff: number): string {
  return levelsOff === 0 ? 'var(--green)' : levelsOff <= HUD_ALT_NEAR ? 'var(--amber)' : 'var(--text)'
}
