import { expect, test } from 'vitest'
import { computeView, HUD_MARGIN } from '../src/render/layout'
import { RADIUS_PX } from '../src/sim'

test('the standard 700x800 window keeps the design scale and puts the globe below the HUD', () => {
  const v = computeView(700, 800, true)
  expect(v.zoom).toBe(RADIUS_PX)
  expect(v.dy).toBeGreaterThan(HUD_MARGIN) // below the centre of the canvas
})

test('the globe with its glow always fits below the HUD, in a window of any shape', () => {
  for (const [w, h] of [[1920, 1080], [2560, 1440], [390, 844], [500, 400], [1200, 500]]) {
    const { zoom, dy } = computeView(w, h, true)
    const outer = 1.112 * zoom
    expect(h / 2 + dy + outer).toBeLessThanOrEqual(h) // bottom edge of the glow is inside the window
    expect(zoom).toBeGreaterThan(0)
  }
})

test('with the game off the globe is centred', () => {
  expect(computeView(1000, 700, false).dy).toBe(0)
})
