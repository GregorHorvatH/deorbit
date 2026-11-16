import { expect, test } from 'vitest'
import { nightFactor, nightLayer, NIGHT_END, NIGHT_START } from '../src/render/style'

test('the night curve: full day right of the transition, full night left of it, smooth in between', () => {
  nightLayer.on = true
  expect(nightFactor(NIGHT_START + 0.01)).toBe(0)
  expect(nightFactor(NIGHT_END - 0.01)).toBe(1)
  const mid = nightFactor((NIGHT_START + NIGHT_END) / 2)
  expect(mid).toBeCloseTo(0.5, 10)
  let prev = -1
  for (let x = 1; x >= -1; x -= 0.01) {
    const f = nightFactor(x)
    expect(f).toBeGreaterThanOrEqual(prev) // moving left only gets darker
    prev = f
  }
})

test('with the Day / night layer off everything is lit evenly', () => {
  nightLayer.on = false
  expect(nightFactor(-1)).toBe(0)
  nightLayer.on = true
})
