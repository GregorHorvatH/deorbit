/** The simulator against frozen reference values (tests/golden/golden.json, computed once by an earlier prototype
 *  implementation; scripts/gen_golden.py shows how). Lengths there are in design pixels (radius 250): divided by `R` here. */
import { describe, expect, test } from 'vitest'
import golden from './golden/golden.json'
import {
  activeSatellites, altLevels, climbPlayer, createGame, interceptForecast, issAltitudes, issBearing, issOmega,
  issSpeedFraction, makeIssOrbit, DESIGN_SPEED, SPEED, makeOrbits, playerPos, rotateHeading, satellitePositions, step, turnPlayer,
  turtleSpeed, bumpPlayer, dist, issPos, ISS_SPAWN_CLEARANCE, startBurn, wreckState, mulberry32, type GameState, type Rng, type V3, type Wreck,
} from '../src/sim'

const R = golden.radius
const EPS = 1e-9
const v3 = (a: number[]): V3 => [a[0], a[1], a[2]]
const scaled = (a: number[]): V3 => [a[0] / R, a[1] / R, a[2] / R]
const near = (a: readonly number[], b: readonly number[], eps = EPS): void => {
  expect(a.length).toBe(b.length)
  a.forEach((x, i) => expect(Math.abs(x - b[i])).toBeLessThan(eps))
}
const closeTo = (a: number, b: number, eps = EPS): void => expect(Math.abs(a - b)).toBeLessThan(eps)

function game(snap: { player: Record<string, unknown>; iss: Record<string, unknown> }, rng: Rng = mulberry32(1)): GameState {
  const g = createGame(rng)
  const pl = snap.player as { p: number[]; t: number[]; alt: number; hit: number; wobble: number }
  const is = snap.iss as { r: number; u: number[]; v: number[]; omega: number; theta: number }
  g.player = { p: v3(pl.p), t: v3(pl.t), alt: pl.alt, hit: pl.hit, wobble: pl.wobble }
  g.iss = { r: is.r / R, u: v3(is.u), v: v3(is.v), omega: is.omega, theta: is.theta }
  return g
}

describe('levels and speeds', () => {
  test('altitude grids', () => {
    near(altLevels(), golden.alt_levels)
    near(issAltitudes(), golden.iss_altitudes)
  })
  test('turtle speed', () => golden.turtle_speed.forEach(([a, w]) => closeTo(turtleSpeed(a), w)))
  test('ISS speed fraction, levels 1..20', () => golden.iss_fraction.forEach(([l, f]) => closeTo(issSpeedFraction(l), f)))
  test('ISS omega', () => golden.iss_omega.forEach(([a, l, w]) => closeTo(issOmega(a, l), w)))
  test('the level table from the README: 5% .. 95%', () => {
    const pct = [1, 2, 3, 4, 5, 6, 8, 11, 12, 13].map((l) => Math.round(issSpeedFraction(l) * 100))
    expect(pct).toEqual([5, 25, 39, 49, 56, 61, 71, 86, 91, 95])
  })
})

describe('orbits', () => {
  test('satellite orbits', () => {
    const o = makeOrbits()
    expect(o.length).toBe(golden.orbits.length)
    golden.orbits.forEach((g, i) => {
      closeTo(o[i].r, g.r / R)
      near(o[i].u, g.u)
      near(o[i].v, g.v)
      closeTo(o[i].omega, g.omega)
      closeTo(o[i].phase, g.phase)
    })
  })
  test('the real ISS orbit', () => {
    const o = makeIssOrbit()
    closeTo(o.r, golden.iss_default.r / R)
    near(o.u, golden.iss_default.u)
    near(o.v, golden.iss_default.v)
  })
  test('satellite positions and how many fly', () => {
    for (const c of golden.sats) {
      const g = createGame(mulberry32(1))
      g.score = c.score
      g.tick = c.tick
      expect(activeSatellites(g)).toBe(c.active)
      const pos = satellitePositions(g)
      expect(pos.length).toBe(c.pos.length)
      pos.forEach((p, i) => near(p, scaled(c.pos[i])))
    }
    const g = createGame(mulberry32(1))
    g.score = 3
    g.layers.game = false
    expect(activeSatellites(g)).toBe(golden.sats_game_off)
  })
})

describe('steering', () => {
  test('rotateHeading', () =>
    golden.rotate.forEach((c) => near(rotateHeading(v3(c.p), v3(c.t), c.rad), c.out)))
  test('turn', () =>
    golden.turn.forEach((c) => {
      const g = createGame(mulberry32(1))
      g.player = { ...g.player, p: v3(c.p), t: v3(c.t) }
      turnPlayer(g, c.sign as 1 | -1)
      near(g.player.t, c.out)
    }))
  test('climb snaps to the altitude grid and clamps', () =>
    golden.climb.forEach((c) => {
      const g = createGame(mulberry32(1))
      g.player.alt = c.alt
      climbPlayer(g, c.sign as 1 | -1)
      closeTo(g.player.alt, c.out)
    }))
})

describe('instruments', () => {
  test('forecast (ETA / MIS) and bearing match the reference', () => {
    golden.forecast.forEach((c) => {
      const g = game(c)
      const f = interceptForecast(g)
      if (c.eta === null) expect(f.eta).toBeNull()
      else {
        expect(f.eta).not.toBeNull()
        closeTo(f.eta as number, c.eta, 1e-7)
      }
      closeTo(f.miss, c.miss / R, 1e-9)
      closeTo(issBearing(g), c.bearing, 1e-7)
    })
  })
})

describe('burning', () => {
  test('start_burn and wreck_state over time', () => {
    golden.wrecks.forEach((c) => {
      const w: Wreck = startBurn(game(c).iss)
      near(w.u0, c.wreck.u0)
      closeTo(w.r0, c.wreck.r0 / R)
      near(w.drift, scaled(c.wreck.drift))
      closeTo(w.tFall, c.wreck.t_fall)
      closeTo(w.tFire, c.wreck.t_fire)
      c.states.forEach((s) => {
        const st = wreckState(w, s.age)
        near(st.p, scaled(s.p))
        expect(st.phase).toBe(s.phase)
        closeTo(st.q, s.q)
      })
    })
  })
})

describe('stepping', () => {
  /** uniform -> middle of its range, choice -> first item: the same pinned source the golden bump used */
  const pinned: Rng = { uniform: (a, b) => (a + b) / 2, gauss: () => 0, choice: (items) => items[0] }

  test('bump', () =>
    golden.bump.forEach((c) => {
      const g = createGame(pinned)
      g.player = { p: v3(c.p), t: v3(c.t), alt: c.alt, hit: 0, wobble: 0 }
      bumpPlayer(g, scaled(c.sat))
      near(g.player.t, c.out.t)
      closeTo(g.player.alt, c.out.alt)
      closeTo(g.player.hit, c.out.hit)
      closeTo(g.player.wobble, c.out.wobble)
    }))

  test('150 steps of mixed length with no events', () => {
    const c = golden.run!
    const g = game(c.before)
    for (const s of c.steps) step(g, s)
    expect(g.score).toBe(0)
    near(g.player.p, c.after.player.p, 1e-8)
    near(g.player.t, c.after.player.t, 1e-8)
    closeTo(g.iss.theta, c.after.iss.theta, 1e-8)
    closeTo(g.tick, c.tick)
    closeTo(g.angle * (DESIGN_SPEED / SPEED), c.angle, 1e-8) // the Earth turns at half the design speed on purpose
  })

  test('a catch scores, starts the burn and spawns the next station', () => {
    const c = golden.catch
    const g = game(c.before)
    let n = 0
    while (g.score === 0 && n < 400) {
      step(g, 1)
      n++
    }
    expect(n).toBe(c.steps)
    expect(g.score).toBe(c.score)
    expect(g.wrecks.length).toBe(1)
    const w = g.wrecks[0]
    near(w.u0, c.wreck.u0, 1e-8)
    closeTo(w.r0, c.wreck.r0 / R, 1e-8)
    near(w.drift, scaled(c.wreck.drift), 1e-8)
    closeTo(w.age, c.wreck.age)
    closeTo(w.tFall, c.wreck.t_fall)
    near(w.p, scaled(c.wreck.p), 1e-8)
    const e = g.effects.find((x) => x.kind === 'capture')!
    closeTo(e.x, c.effect0[0] / R, 1e-8)
    closeTo(e.y, c.effect0[1] / R, 1e-8)
    near(g.player.p, c.player.p, 1e-8)
    // the next station is on a fresh orbit at one of the allowed altitudes, clear of the turtle; level 2 adds a satellite
    expect(issAltitudes().some((a) => Math.abs(a - g.iss.r) < 1e-12)).toBe(true)
    expect(dist(issPos(g), playerPos(g))).toBeGreaterThan(ISS_SPAWN_CLEARANCE)
    expect(activeSatellites(g)).toBe(1)
    expect(g.effects.some((x) => x.kind === 'spawn')).toBe(true)
  })
})
