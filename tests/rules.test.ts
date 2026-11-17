import { describe, expect, test } from 'vitest'
import {
  altLevels, bumpPlayer, createGame, DECAY_STEPS, FINAL_LEVEL, FUEL_DOWN, FUEL_MAX, FUEL_PER_CATCH, FUEL_TURN, FUEL_UP,
  BARREL_BELOW, BARREL_FUEL, spawnBarrel, hudSnapshot, issSpeedFraction, JET_STEPS, mulberry32, PLAYER_ALT_RANGE, playerPos, resetGame, spawnHeart,
  inWarning, endPending, ENDING_DELAY_STEPS, WARN_STEPS, startBurn, STEPS_PER_SECOND, step, steerPlayer, HULL_MAX, ISS_SPAWN_CLEARANCE, dist, onOrbit, type GameState, type Rng,
} from '../src/sim'

/** A game with the satellites switched off, the ISS parked far away: only the rule under test happens. */
function quiet(seed = 1): GameState {
  const g = createGame(mulberry32(seed))
  g.layers.sats = false
  g.iss.omega = 0
  g.iss.theta = 0
  g.iss.u = [0, 0, 1]
  g.iss.v = [1, 0, 0]
  g.player.alt = 1.22
  return g
}
const run = (g: GameState, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * STEPS_PER_SECOND); i++) step(g, 1)
}
/** The ISS (a station) is moved out of the way of a turtle that sits still enough: the turtle flies, so park the ISS opposite. */
function farIss(g: GameState): void {
  const p = playerPos(g)
  g.iss.u = [-p[0], -p[1], -p[2]]
  g.iss.v = [0, 0, 1]
  g.iss.r = 1
}

describe('the end of the game', () => {
  test('the final level is the one where the ISS reaches 95%: 13', () => {
    expect(FINAL_LEVEL).toBe(13)
    expect(issSpeedFraction(FINAL_LEVEL)).toBeCloseTo(0.95, 10)
    expect(issSpeedFraction(FINAL_LEVEL - 1)).toBeLessThan(0.95)
  })

  test('catching the ISS on the final level wins; before that the game goes on', () => {
    const g = quiet()
    g.score = FINAL_LEVEL - 2 // the next catch is number FINAL_LEVEL - 1
    g.iss = { r: g.player.alt, u: g.player.p, v: g.player.t, omega: 0.0005, theta: 0.2 }
    run(g, 5)
    expect(g.score).toBe(FINAL_LEVEL - 1)
    expect(g.status).toBe('playing')
    g.iss = { r: g.player.alt, u: g.player.p, v: g.player.t, omega: 0.0005, theta: 0.2 }
    run(g, 5)
    expect(g.score).toBe(FINAL_LEVEL)
    expect(g.status).toBe('won')
    expect(g.events).toContain('won')
  })

  test('after the end nothing plays: the turtle stands still, the wreck of the last catch keeps falling', () => {
    const g = quiet()
    g.score = FINAL_LEVEL - 1
    g.iss = { r: g.player.alt, u: g.player.p, v: g.player.t, omega: 0.0005, theta: 0.2 }
    run(g, 5)
    expect(g.status).toBe('won')
    const p = [...g.player.p]
    const wreck = g.wrecks.length
    run(g, 0.2)
    expect(g.player.p).toEqual(p)
    expect(g.wrecks.length).toBe(wreck)
    run(g, 2)
    expect(g.wrecks.length).toBe(0) // burnt out
  })
})

describe('hull', () => {
  const sat = (g: GameState) => onOrbit(g.player.alt + 0.03, g.player.p, g.player.t, 0.02)

  test('a hit costs one hull point; the third one loses the game and the turtle burns', () => {
    const g = quiet()
    expect(g.hull).toBe(HULL_MAX)
    bumpPlayer(g, sat(g))
    expect(g.hull).toBe(HULL_MAX - 1)
    expect(g.status).toBe('playing')
    bumpPlayer(g, sat(g))
    bumpPlayer(g, sat(g))
    expect(g.hull).toBe(0)
    expect(g.status).toBe('lost')
    expect(g.lostReason).toBe('hull')
    expect(g.events).toContain('lost')
    expect(g.wrecks.at(-1)?.kind).toBe('turtle')
  })

  test('a lost game stays lost, and a second loss changes nothing', () => {
    const g = quiet()
    for (let i = 0; i < 3; i++) bumpPlayer(g, sat(g))
    const wrecks = g.wrecks.length
    bumpPlayer(g, sat(g))
    expect(g.wrecks.length).toBe(wrecks)
    expect(steerPlayer(g, 'left')).toBe(false)
  })
})

describe('fuel', () => {
  test('every press costs its price and starts a jet puff', () => {
    const g = quiet()
    expect(steerPlayer(g, 'left')).toBe(true)
    expect(g.fuel).toBe(FUEL_MAX - FUEL_TURN)
    expect(g.jet).toEqual({ kind: 'left', life: JET_STEPS })
    steerPlayer(g, 'up')
    expect(g.fuel).toBe(FUEL_MAX - FUEL_TURN - FUEL_UP)
    steerPlayer(g, 'down')
    expect(g.fuel).toBe(FUEL_MAX - FUEL_TURN - FUEL_UP - FUEL_DOWN)
  })

  test('the puff dies away by itself', () => {
    const g = quiet()
    steerPlayer(g, 'right')
    run(g, (JET_STEPS + 2) / STEPS_PER_SECOND)
    expect(g.jet).toBeNull()
  })

  test('without enough fuel nothing happens, and a press that cannot move the orbit costs nothing', () => {
    const g = quiet()
    g.fuel = FUEL_TURN - 1
    const t = [...g.player.t]
    expect(steerPlayer(g, 'left')).toBe(false)
    expect(g.player.t).toEqual(t)
    expect(g.fuel).toBe(FUEL_TURN - 1)
    g.fuel = FUEL_MAX
    g.player.alt = PLAYER_ALT_RANGE[1]
    expect(steerPlayer(g, 'up')).toBe(false)
    expect(g.fuel).toBe(FUEL_MAX)
    g.player.alt = PLAYER_ALT_RANGE[0]
    expect(steerPlayer(g, 'down')).toBe(false)
    expect(g.fuel).toBe(FUEL_MAX)
  })

  test('steering only works while playing (not on the title screen, not paused)', () => {
    const g = quiet()
    for (const status of ['ready', 'paused', 'won', 'lost'] as const) {
      g.status = status
      expect(steerPlayer(g, 'left')).toBe(false)
    }
    expect(g.fuel).toBe(FUEL_MAX)
  })

  test('a caught ISS refuels (up to the tank)', () => {
    const g = quiet()
    g.fuel = 10
    g.iss = { r: g.player.alt, u: g.player.p, v: g.player.t, omega: 0.0005, theta: 0.2 }
    run(g, 5)
    expect(g.score).toBe(1)
    expect(g.fuel).toBe(10 + FUEL_PER_CATCH)
    g.fuel = FUEL_MAX - 5
    g.iss = { r: g.player.alt, u: g.player.p, v: g.player.t, omega: 0.0005, theta: 0.2 }
    run(g, 5)
    expect(g.fuel).toBe(FUEL_MAX)
  })
})

describe('fuel use', () => {
  test('the prices: a tank of 100, a turn 2, a climb 4, a descent 1; a catch gives 60, a barrel 40', () => {
    expect([FUEL_MAX, FUEL_TURN, FUEL_UP, FUEL_DOWN, FUEL_PER_CATCH, BARREL_FUEL]).toEqual([100, 2, 4, 1, 60, 40])
  })
})

describe('orbit decay', () => {
  test('every DECAY_STEPS the orbit sinks one level, with a sound; the countdown restarts', () => {
    const g = quiet()
    farIss(g)
    const levels = altLevels()
    const start = levels.findIndex((a) => Math.abs(a - g.player.alt) < 1e-9)
    for (let i = 0; i < DECAY_STEPS - 1; i++) step(g, 1)
    expect(g.player.alt).toBeCloseTo(levels[start], 9)
    g.iss.omega = 0
    step(g, 1)
    expect(g.player.alt).toBeCloseTo(levels[start - 1], 9)
    expect(g.events).toContain('decay')
    expect(hudSnapshot(g).decayIn).toBeCloseTo(DECAY_STEPS / STEPS_PER_SECOND, 5)
  })

  test('below the lowest orbit the turtle burns up (re-entry)', () => {
    const g = quiet()
    g.player.alt = PLAYER_ALT_RANGE[0]
    expect(hudSnapshot(g).lowest).toBe(true)
    for (let i = 0; i < DECAY_STEPS; i++) step(g, 1)
    expect(g.status).toBe('lost')
    expect(g.lostReason).toBe('reentry')
    expect(g.wrecks.at(-1)?.kind).toBe('turtle')
  })

  test('climbing outside the alarm window raises the orbit as before and so buys time', () => {
    const g = quiet()
    g.player.alt = PLAYER_ALT_RANGE[0]
    expect(inWarning(g)).toBe(false)
    steerPlayer(g, 'up')
    expect(g.player.alt).toBeGreaterThan(PLAYER_ALT_RANGE[0] + 1e-9)
    for (let i = 0; i < DECAY_STEPS; i++) step(g, 1)
    expect(g.status).toBe('playing') // it sank back to the lowest orbit, not below
  })
})

describe('the alarm before the sinking, and holding the altitude', () => {
  const count = (g: GameState, name: string): number => g.events.filter((e) => e === name).length
  const toWindow = (g: GameState): void => {
    farIss(g)
    while (g.decay > WARN_STEPS - 5) step(g, 1) // a little way into the window
    g.events.length = 0
  }

  test('no alarm until the last 3 seconds; then beeps, one when the window opens and one every half second', () => {
    const g = quiet()
    farIss(g)
    for (let i = 0; i < DECAY_STEPS - WARN_STEPS - 1; i++) step(g, 1)
    expect(g.events.filter((e) => e === 'warn' || e === 'danger')).toEqual([])
    expect(inWarning(g)).toBe(false)
    for (let i = 0; i < WARN_STEPS - 1; i++) step(g, 1)
    expect(inWarning(g)).toBe(true)
    expect(count(g, 'warn')).toBeGreaterThanOrEqual(5)
    expect(count(g, 'warn')).toBeLessThanOrEqual(7)
    expect(count(g, 'danger')).toBe(0)
  })

  test('on the lowest orbit the alarm is the harsher one and comes twice as often', () => {
    const g = quiet()
    g.player.alt = PLAYER_ALT_RANGE[0]
    farIss(g)
    for (let i = 0; i < DECAY_STEPS - 2; i++) step(g, 1)
    expect(count(g, 'warn')).toBe(0)
    expect(count(g, 'danger')).toBeGreaterThanOrEqual(10)
    expect(count(g, 'danger')).toBeLessThanOrEqual(13)
  })

  test('Up in the window HOLDS the orbit: the altitude stays, it costs a climb of fuel, the alarm stops, the sinking is cancelled', () => {
    const g = quiet()
    toWindow(g)
    const alt = g.player.alt
    const fuel = g.fuel
    expect(steerPlayer(g, 'up')).toBe(true)
    expect(g.player.alt).toBe(alt) // not raised
    expect(g.fuel).toBe(fuel - FUEL_UP)
    expect(g.decay).toBe(DECAY_STEPS)
    expect(inWarning(g)).toBe(false)
    expect(g.events).toContain('hold')
    expect(g.jet?.kind).toBe('up')
    g.events.length = 0
    for (let i = 0; i < DECAY_STEPS - WARN_STEPS - 2; i++) step(g, 1)
    expect(g.player.alt).toBe(alt) // the orbit did not sink
    expect(g.events.filter((e) => e === 'warn' || e === 'danger' || e === 'decay')).toEqual([]) // and it is quiet
  })

  test('if you do not hold, the orbit sinks one level as before', () => {
    const g = quiet()
    toWindow(g)
    const alt = g.player.alt
    for (let i = 0; i < WARN_STEPS + 2; i++) step(g, 1)
    expect(g.player.alt).toBeLessThan(alt - 1e-9)
    expect(g.events).toContain('decay')
  })

  test('on the lowest orbit holding saves the turtle from re-entry, and the alarm starts again 20 s later', () => {
    const g = quiet()
    g.player.alt = PLAYER_ALT_RANGE[0]
    toWindow(g)
    expect(steerPlayer(g, 'up')).toBe(true)
    expect(g.player.alt).toBe(PLAYER_ALT_RANGE[0])
    for (let i = 0; i < DECAY_STEPS - WARN_STEPS - 2; i++) step(g, 1)
    expect(g.status).toBe('playing')
    g.events.length = 0
    for (let i = 0; i < 6; i++) step(g, 1)
    expect(g.events).toContain('danger') // the window is open again
  })

  test('on the highest orbit Up still holds (outside the window it does nothing, for free)', () => {
    const g = quiet()
    g.player.alt = PLAYER_ALT_RANGE[1]
    expect(steerPlayer(g, 'up')).toBe(false)
    expect(g.fuel).toBe(FUEL_MAX)
    toWindow(g)
    expect(steerPlayer(g, 'up')).toBe(true)
    expect(g.player.alt).toBe(PLAYER_ALT_RANGE[1])
  })

  test('without fuel for it the orbit cannot be held', () => {
    const g = quiet()
    toWindow(g)
    g.fuel = FUEL_UP - 1
    expect(steerPlayer(g, 'up')).toBe(false)
    expect(hudSnapshot(g)).toMatchObject({ warning: true, canHold: false })
    const alt = g.player.alt
    for (let i = 0; i < WARN_STEPS + 2; i++) step(g, 1)
    expect(g.player.alt).toBeLessThan(alt - 1e-9)
  })

  test('the other keys work as usual in the window, and Down can still lower the orbit', () => {
    const g = quiet()
    toWindow(g)
    const alt = g.player.alt
    expect(steerPlayer(g, 'down')).toBe(true)
    expect(g.player.alt).toBeLessThan(alt - 1e-9)
    expect(g.decay).toBeLessThanOrEqual(WARN_STEPS) // it does not hold anything
  })
})

describe('the end screen waits for the fire, and one second more', () => {
  test('after a loss the end is pending while the turtle burns and for one second after; then the card may appear', () => {
    const g = quiet()
    farIss(g)
    g.player.alt = PLAYER_ALT_RANGE[0]
    for (let i = 0; i < DECAY_STEPS; i++) step(g, 1)
    expect(g.status).toBe('lost')
    expect(endPending(g)).toBe(true)
    expect(hudSnapshot(g).ending).toBe(true)
    let steps = 0
    let fireOut = -1
    while (endPending(g) && steps < 300) {
      step(g, 1)
      steps++
      if (fireOut < 0 && g.wrecks.length === 0) fireOut = steps
    }
    expect(endPending(g)).toBe(false)
    expect(hudSnapshot(g)).toMatchObject({ status: 'lost', ending: false })
    expect(g.events).toContain('burnout')
    expect(fireOut).toBeGreaterThan(10) // the fall and the fire take a moment (about 0.6 s)
    expect(fireOut).toBeLessThan(60)
    expect(steps - fireOut).toBe(ENDING_DELAY_STEPS) // and then exactly one second of calm
  })

  test('the same after a win: the last station burns, then one second, then the card', () => {
    const g = quiet()
    g.score = FINAL_LEVEL - 1
    g.iss = { r: g.player.alt, u: g.player.p, v: g.player.t, omega: 0.0005, theta: 0.2 }
    for (let i = 0; i < 400 && g.status !== 'won'; i++) step(g, 1)
    expect(g.status).toBe('won')
    expect(endPending(g)).toBe(true) // the station is only just caught: it is falling
    let steps = 0
    while (endPending(g) && steps < 300) {
      step(g, 1)
      steps++
    }
    expect(endPending(g)).toBe(false)
    expect(g.wrecks.length).toBe(0)
  })

  test('nothing is pending while the game is on', () => {
    const g = quiet()
    expect(endPending(g)).toBe(false)
    g.status = 'paused'
    expect(endPending(g)).toBe(false)
  })
})

describe('hearts', () => {
  test('no heart while the hull is whole, however long it takes', () => {
    const g = quiet()
    for (let i = 0; i < 60 * STEPS_PER_SECOND; i++) {
      g.player.alt = 1.22 // keep clear of the decay: this test is about hearts
      g.decay = DECAY_STEPS
      step(g, 1)
    }
    expect(g.heart).toBeNull()
    expect(g.heartSerial).toBe(0)
  })

  test('with a damaged hull a heart appears after 20-30 seconds', () => {
    const g = quiet()
    g.hull = 2
    let appeared = -1
    for (let i = 0; i < 40 * STEPS_PER_SECOND; i++) {
      g.decay = DECAY_STEPS
      g.player.hit = 0
      step(g, 1)
      if (g.heart) {
        appeared = i / STEPS_PER_SECOND
        break
      }
    }
    expect(appeared).toBeGreaterThanOrEqual(19.5)
    expect(appeared).toBeLessThanOrEqual(30.5)
    expect(altLevels().some((a) => Math.abs(a - g.heart!.r) < 1e-9)).toBe(true)
    expect(dist(onOrbit(g.heart!.r, g.heart!.u, g.heart!.v, g.heart!.theta), playerPos(g))).toBeGreaterThan(ISS_SPAWN_CLEARANCE)
  })

  test('an uncaught heart never expires: it waits, however long, until it is caught', () => {
    const g = quiet()
    g.hull = 1
    spawnHeart(g, [10, 10, 10])
    for (let i = 0; i < 120 * STEPS_PER_SECOND; i++) {
      g.decay = DECAY_STEPS
      g.player.hit = 100 // no satellites anyway
      // never let the turtle catch it: put the heart opposite the turtle every step
      g.heart!.u = [-g.player.p[0], -g.player.p[1], -g.player.p[2]]
      g.heart!.v = [0, 0, 1]
      g.heart!.r = 1.3
      g.heart!.theta = 0
      g.heart!.omega = 0
      step(g, 1)
    }
    expect(g.heart).not.toBeNull()
    expect(g.wrecks).toHaveLength(0)
    expect(g.hull).toBe(1) // nothing was healed
  })

  test('a caught heart gives back ONE hull point, never above the maximum', () => {
    for (const [hull, after] of [[1, 2], [2, 3], [HULL_MAX, HULL_MAX]] as const) {
      const g = quiet()
      g.hull = hull
      spawnHeart(g, [10, 10, 10])
      g.heart!.u = g.player.p
      g.heart!.v = g.player.t
      g.heart!.r = g.player.alt
      g.heart!.theta = 0.05
      g.heart!.omega = 0
      run(g, 1)
      expect(g.heart).toBeNull()
      expect(g.hull).toBe(after)
      expect(g.events).toContain('heal')
    }
  })

  test('hearts never touch the main random generator (the sequence of ISS orbits stays the same)', () => {
    let calls = 0
    const counting: Rng = { uniform: (a, b) => (calls++, (a + b) / 2), gauss: () => (calls++, 0), choice: (xs) => (calls++, xs[0]) }
    const g = createGame(counting)
    calls = 0
    spawnHeart(g, [10, 10, 10])
    expect(calls).toBe(0)
  })

  test('hearts are deterministic: the same serial gives the same orbit', () => {
    const a = quiet(1)
    const b = quiet(99)
    spawnHeart(a, [10, 10, 10])
    spawnHeart(b, [10, 10, 10])
    expect(a.heart).toEqual(b.heart)
    spawnHeart(a, [10, 10, 10]) // the next one differs
    expect(a.heart).not.toEqual(b.heart)
  })
})

describe('barrels of fuel', () => {
  const hold = (g: GameState): void => {
    g.decay = DECAY_STEPS // keep clear of the decay: these tests are about barrels
    g.player.hit = 100
  }

  test('no barrel while the tank is well filled', () => {
    const g = quiet()
    g.fuel = FUEL_MAX
    for (let i = 0; i < 60 * STEPS_PER_SECOND; i++) {
      hold(g)
      step(g, 1)
    }
    expect(g.barrel).toBeNull()
    expect(g.barrelSerial).toBe(0)
  })

  test('with a low tank a barrel appears after 25-35 seconds, at a turtle altitude, clear of the turtle', () => {
    const g = quiet()
    g.fuel = FUEL_MAX * BARREL_BELOW - 1
    let appeared = -1
    for (let i = 0; i < 40 * STEPS_PER_SECOND; i++) {
      hold(g)
      step(g, 1)
      if (g.barrel) {
        appeared = i / STEPS_PER_SECOND
        break
      }
    }
    expect(appeared).toBeGreaterThanOrEqual(24.5)
    expect(appeared).toBeLessThanOrEqual(35.5)
    expect(altLevels().some((a) => Math.abs(a - g.barrel!.r) < 1e-9)).toBe(true)
    expect(dist(onOrbit(g.barrel!.r, g.barrel!.u, g.barrel!.v, g.barrel!.theta), playerPos(g))).toBeGreaterThan(ISS_SPAWN_CLEARANCE)
    expect(hudSnapshot(g).barrel).toBe(true)
  })

  test('a caught barrel adds its fuel, never above the tank', () => {
    for (const [fuel, after] of [[10, 10 + BARREL_FUEL], [FUEL_MAX - 5, FUEL_MAX]] as const) {
      const g = quiet()
      g.fuel = fuel
      spawnBarrel(g, [10, 10, 10])
      g.barrel!.u = g.player.p
      g.barrel!.v = g.player.t
      g.barrel!.r = g.player.alt
      g.barrel!.theta = 0.05
      g.barrel!.omega = 0
      run(g, 1)
      expect(g.barrel).toBeNull()
      expect(g.fuel).toBe(after)
      expect(g.events).toContain('refuel')
    }
  })

  test('an uncaught barrel never expires: it waits, however long, until it is caught', () => {
    const g = quiet()
    g.fuel = 10
    spawnBarrel(g, [10, 10, 10])
    for (let i = 0; i < 120 * STEPS_PER_SECOND; i++) {
      hold(g)
      // keep it away from the turtle: opposite the turtle, not moving
      g.barrel!.u = [-g.player.p[0], -g.player.p[1], -g.player.p[2]]
      g.barrel!.v = [0, 0, 1]
      g.barrel!.theta = 0
      g.barrel!.omega = 0
      step(g, 1)
    }
    expect(g.barrel).not.toBeNull()
    expect(g.wrecks).toHaveLength(0)
    expect(g.fuel).toBe(10)
  })

  describe('with no fuel left the barrel may wait on the turtle\'s own orbit', () => {
    const noFuel = (serial: number): GameState => {
      const g = quiet()
      g.fuel = 0
      g.barrelSerial = serial
      return g
    }
    const onTurtleOrbit = (g: GameState): boolean => g.barrel!.u === g.player.p && g.barrel!.v === g.player.t

    test('about 65% of them (the same every game); a turtle that still has fuel never gets one', () => {
      let future = 0
      const N = 400
      for (let i = 0; i < N; i++) {
        const g = noFuel(i)
        spawnBarrel(g, [10, 10, 10])
        if (onTurtleOrbit(g)) future++
        const h = quiet()
        h.fuel = FUEL_DOWN
        h.barrelSerial = i
        spawnBarrel(h, [10, 10, 10])
        expect(onTurtleOrbit(h)).toBe(false)
      }
      expect(future / N).toBeGreaterThan(0.58)
      expect(future / N).toBeLessThan(0.72)
    })

    test('the turtle that flies on, steering nothing, picks it up on the way (2-3 turns ahead)', () => {
      let caught = 0
      let tried = 0
      for (let i = 0; i < 60; i++) {
        const g = noFuel(i)
        g.player.hit = 1e9 // nothing bumps it
        spawnBarrel(g, [10, 10, 10])
        if (!onTurtleOrbit(g)) continue
        tried++
        for (let s = 0; s < 45 * STEPS_PER_SECOND && g.barrel && g.status === 'playing'; s++) step(g, 1) // 45 s is 3+ turns
        if (g.barrel === null && g.fuel === BARREL_FUEL) caught++
      }
      expect(tried).toBeGreaterThan(20)
      expect(caught).toBe(tried) // every one of them can be reached
    })
  })

  test('barrels never touch the main random generator, and a heart and a barrel can fly together', () => {
    let calls = 0
    const counting: Rng = { uniform: (a, b) => (calls++, (a + b) / 2), gauss: () => (calls++, 0), choice: (xs) => (calls++, xs[0]) }
    const g = createGame(counting)
    calls = 0
    spawnBarrel(g, [10, 10, 10])
    spawnHeart(g, [10, 10, 10])
    expect(calls).toBe(0)
    expect(g.barrel).not.toBeNull()
    expect(g.heart).not.toBeNull()
  })
})

describe('start, pause, restart', () => {
  test('a paused game does not move at all', () => {
    const g = quiet()
    g.status = 'paused'
    const before = JSON.stringify([g.tick, g.angle, g.player.p, g.iss.theta, g.elapsed, g.decay])
    run(g, 2)
    expect(JSON.stringify([g.tick, g.angle, g.player.p, g.iss.theta, g.elapsed, g.decay])).toBe(before)
  })

  test('on the title screen the world turns but the rules wait', () => {
    const g = quiet()
    g.status = 'ready'
    g.iss.omega = 0.001
    const p = [...g.player.p]
    run(g, 1)
    expect(g.player.p).toEqual(p)
    expect(g.iss.theta).toBeGreaterThan(0)
    expect(g.angle).toBeGreaterThan(0)
    expect(g.elapsed).toBe(0)
  })

  test('a restart gives a fresh game and keeps the layer switches', () => {
    const g = quiet()
    g.score = 5
    g.hull = 1
    g.fuel = 3
    g.status = 'lost'
    g.layers.sats = false
    resetGame(g, mulberry32(7))
    expect(g).toMatchObject({ score: 0, hull: HULL_MAX, fuel: FUEL_MAX, status: 'playing', decay: DECAY_STEPS, elapsed: 0, heart: null, barrel: null, wrecks: [] })
    expect(g.layers.sats).toBe(false)
  })

  test('elapsed time counts only while playing', () => {
    const g = quiet()
    farIss(g)
    run(g, 3)
    expect(g.elapsed).toBe(3 * STEPS_PER_SECOND)
  })

  test('the snapshot for the screens carries the status and the numbers', () => {
    const g = quiet()
    g.hull = 2
    g.fuel = 33
    spawnHeart(g, [10, 10, 10])
    expect(hudSnapshot(g)).toMatchObject({ status: 'playing', hull: 2, hullMax: HULL_MAX, fuel: 33, fuelMax: FUEL_MAX, finalLevel: 13, heart: true, lostReason: null })
  })

  test('a burn of the turtle starts where it flies', () => {
    const g = quiet()
    const w = startBurn({ r: g.player.alt, u: g.player.p, v: g.player.t, omega: 0.02, theta: 0 }, 'turtle')
    expect(w.kind).toBe('turtle')
    expect(dist(w.p, playerPos(g))).toBeLessThan(1e-9)
  })
})
