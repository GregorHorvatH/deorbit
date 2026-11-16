import { Color } from 'three'
import { BURN_COLORS, nightFactor } from './style'

const cache = new Map<string, Color>()
/** A cached colour (plain display values: colour management is off, see App.tsx). Do not mutate. */
export function hex(c: string): Color {
  let v = cache.get(c)
  if (!v) cache.set(c, (v = new Color(c)))
  return v
}

/** out = day -> night colour of an object standing at world x. */
export function shade(out: Color, pair: readonly [string, string], x: number): Color {
  return out.lerpColors(hex(pair[0]), hex(pair[1]), nightFactor(x))
}

/** Colour of burning metal: f = 0 white-hot ... f = 1 a cooled ember. */
export function fireColor(out: Color, f: number): Color {
  const n = BURN_COLORS.length - 1
  const x = Math.min(1, Math.max(0, f)) * n
  const i = Math.min(n - 1, Math.floor(x))
  return out.lerpColors(hex(BURN_COLORS[i]), hex(BURN_COLORS[i + 1]), x - i)
}
