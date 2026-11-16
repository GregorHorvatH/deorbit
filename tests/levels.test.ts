import { describe, expect, test } from 'vitest'
import {
  altLevels, createGame, issAltitudes, issOmega, issSpeedFraction, level, mulberry32, playerPos, STEPS_PER_SECOND,
  step, turtleSpeed, type GameState,
} from '../src/sim'

const degPerSec = (omega: number): number => (omega * STEPS_PER_SECOND * 180) / Math.PI

describe('the speed system', () => {
  // the table of ISS speeds by level, for an orbit at altitude 1.22 where the turtle does 46 deg/s
  test('matches the README table (deg/s at altitude 1.22)', () => {
    const table: Array<[number, number]> = [[1, 2], [2, 11], [3, 18], [4, 22], [5, 26], [6, 28], [8, 32], [11, 39], [12, 42], [13, 44]]
    expect(degPerSec(turtleSpeed(1.22))).toBeCloseTo(45.8, 1)
    for (const [lvl, deg] of table) expect(Math.abs(degPerSec(issOmega(1.22, lvl)) - deg)).toBeLessThan(0.8)
  })

  test('the ISS gets faster every level and never overtakes the turtle on its own orbit', () => {
    let prev = 0
    for (let lvl = 1; lvl <= 40; lvl++) {
      const f = issSpeedFraction(lvl)
      expect(f).toBeGreaterThanOrEqual(prev)
      expect(f).toBeLessThanOrEqual(0.95 + 1e-12)
      prev = f
      for (const alt of altLevels()) expect(issOmega(alt, lvl)).toBeLessThan(turtleSpeed(alt))
    }
    expect(issSpeedFraction(13)).toBeCloseTo(0.95, 10)
    expect(issSpeedFraction(40)).toBeCloseTo(0.95, 10)
  })

  test('the speed a station really flies at equals issOmega(altitude, level): it advances omega per step', () => {
    for (const lvl of [1, 3, 7, 13]) {
      const g = createGame(mulberry32(5))
      g.score = lvl - 1
      g.layers.sats = false
      g.iss.omega = issOmega(g.iss.r, lvl)
      g.player.alt = 1.1 // far from everything
      const t0 = g.iss.theta
      for (let i = 0; i < 40; i++) step(g, 1) // exactly one second
      expect(degPerSec((g.iss.theta - t0) / 40)).toBeCloseTo(degPerSec(issOmega(g.iss.r, lvl)), 6)
    }
  })

  test('every newly spawned station uses the CURRENT level (the level it was caught at + 1)', () => {
    const g = createGame(mulberry32(7))
    for (let n = 0; n < 12; n++) {
      // park the ISS just ahead of the turtle on its own orbit and fly until it is caught
      g.iss = { r: g.player.alt, u: g.player.p, v: g.player.t, omega: 0.0005, theta: 0.2 }
      g.layers.sats = false // no bumps: this test is about speeds
      const before = g.score
      for (let i = 0; i < 400 && g.score === before; i++) step(g, 1)
      expect(g.score).toBe(before + 1)
      expect(issAltitudes().some((a) => Math.abs(a - g.iss.r) < 1e-12)).toBe(true)
      expect(g.iss.omega).toBeCloseTo(issOmega(g.iss.r, level(g)), 12)
      expect(g.iss.omega).toBeLessThan(turtleSpeed(g.iss.r))
    }
    expect(playerPos(g as GameState)).toBeDefined()
  })
})

describe('events for the outside world', () => {
  test('a catch reports capture + spawn (a new satellite), and a burn-out follows later', () => {
    const g = createGame(mulberry32(3))
    g.iss = { r: g.player.alt, u: g.player.p, v: g.player.t, omega: 0.0005, theta: 0.2 }
    for (let i = 0; i < 400 && g.score === 0; i++) step(g, 1)
    expect(g.events).toContain('capture')
    expect(g.events).toContain('spawn')
    g.layers.sats = false // no bumps from here on
    g.events.length = 0
    for (let i = 0; i < 80; i++) step(g, 1) // the wreck burns for under a second (40 steps)
    expect(g.events).toEqual(['burnout'])
  })
})
