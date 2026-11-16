/** The one live simulation and its fixed-step clock. React never holds game state: renderers read `world` in useFrame. */
import { createGame, issOmega, level, MAX_STEPS, mulberry32, randomSeed, step, TICK_MS, type GameState } from '../sim'

export const world: { game: GameState; alpha: number; acc: number } = {
  game: createGame(mulberry32(randomSeed())),
  alpha: 0, // how far (0..1) the render is between the last simulated step and the next one
  acc: 0, // milliseconds not yet simulated
}

/** Advances the simulation by `dt` seconds in whole TICK_MS steps (40 Hz). After a pause it never jumps by more than
 *  MAX_STEPS steps. */
export function advance(dt: number): void {
  world.acc += Math.min(dt * 1000, MAX_STEPS * TICK_MS)
  while (world.acc >= TICK_MS) {
    step(world.game, 1)
    world.acc -= TICK_MS
  }
  world.alpha = world.acc / TICK_MS
}

/** Simulation time in steps, including the part-step the render is ahead by. */
export const renderTick = (): number => world.game.tick + world.alpha

// dev only: ?score=7 starts on level 8 (to look at the satellites without playing)
if (import.meta.env.DEV) {
  const score = Number(new URLSearchParams(location.search).get('score'))
  if (Number.isInteger(score) && score > 0) {
    world.game.score = score
    world.game.iss.omega = issOmega(world.game.iss.r, level(world.game)) // the station created at level 1 speeds up too
  }
  ;(window as unknown as { __world: typeof world }).__world = world // for the browser tests / console
}
