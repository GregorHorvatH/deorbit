/** The random numbers the game needs, behind an interface so tests can inject a fixed or seeded source. */
export interface Rng {
  /** uniform in [a, b) */
  uniform(a: number, b: number): number
  /** normal distribution */
  gauss(mu: number, sigma: number): number
  choice<T>(items: readonly T[]): T
}

/** mulberry32: a small, fast seeded generator. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    uniform: (lo, hi) => lo + (hi - lo) * next(),
    gauss: (mu, sigma) => {
      // Box-Muller
      const u1 = 1 - next()
      const u2 = next()
      return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    },
    choice: (items) => items[Math.floor(next() * items.length)],
  }
}

export const randomSeed = (): number => (Math.random() * 2 ** 32) >>> 0
