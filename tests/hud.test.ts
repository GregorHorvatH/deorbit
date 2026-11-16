import { expect, test } from 'vitest'
import { CATCH_RADIUS, createGame, hudSnapshot, issOmega, mulberry32, STEPS_PER_SECOND } from '../src/sim'

test('the instruments of a collision course: same altitude level, ISS ahead, miss below the catch radius', () => {
  const g = createGame(mulberry32(1))
  g.iss = { r: g.player.alt, u: g.player.p, v: g.player.t, omega: issOmega(g.player.alt, 1), theta: 0.4 }
  const h = hudSnapshot(g)
  expect(h.levelsOff).toBe(0)
  expect(h.miss).toBeLessThan(CATCH_RADIUS)
  expect(h.eta).not.toBeNull()
  expect(Math.abs(h.bearing)).toBeLessThan(1) // dead ahead
  expect(h.turSpeed).toBeCloseTo(((0.02 * STEPS_PER_SECOND) * 180) / Math.PI, 5)
  expect(h.level).toBe(1)
  expect(h.sats).toBe(0)
})

test('the satellite count and level follow the score', () => {
  const g = createGame(mulberry32(1))
  g.score = 4
  expect(hudSnapshot(g)).toMatchObject({ score: 4, level: 5, sats: 4 })
})
