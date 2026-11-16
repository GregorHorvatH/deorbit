/** Procedural sound effects: no audio files. Every sound is a few lines of maths turned into 16-bit mono PCM at start-up
 *  (a fraction of a second of work) and handed to Howler as a WAV. Deterministic: the same call gives the same samples. */
import { mulberry32 } from '../sim/rng'

export const RATE = 22050

const buf = (seconds: number): Float32Array => new Float32Array(Math.round(seconds * RATE))

/** A pitch glide f0 -> f1 (exponential) with a fast attack and a power-law decay, ADDED to `out` at `start` seconds. */
function tone(out: Float32Array, start: number, dur: number, f0: number, f1: number, amp: number, decay = 2): void {
  const n = Math.round(dur * RATE)
  const i0 = Math.round(start * RATE)
  let phase = 0
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const t = i / n
    const f = f0 * (f1 / f0) ** t
    phase += (2 * Math.PI * f) / RATE
    const attack = Math.min(1, i / (0.004 * RATE))
    out[i0 + i] += Math.sin(phase) * amp * attack * (1 - t) ** decay
  }
}

/** Low-passed noise (`lp` 0..1: higher = brighter) with an envelope env(t in 0..1), ADDED to `out`. */
function noise(out: Float32Array, start: number, dur: number, amp: number, lp: number, env: (t: number) => number, seed: number): void {
  const rnd = mulberry32(seed)
  const n = Math.round(dur * RATE)
  const i0 = Math.round(start * RATE)
  let y = 0
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    y += lp * (rnd.uniform(-1, 1) - y)
    out[i0 + i] += y * amp * env(i / n)
  }
}

/** Scales the buffer so its loudest sample is `peak`. */
function limit(out: Float32Array, peak: number): Float32Array {
  let m = 0
  for (const v of out) m = Math.max(m, Math.abs(v))
  if (m > 0) for (let i = 0; i < out.length; i++) out[i] *= peak / m
  return out
}

/** A short UI tick; the pitch tells the four keys apart (left, right, up, down). */
export function tick(freq: number): Float32Array {
  const o = buf(0.06)
  tone(o, 0, 0.06, freq, freq * 0.7, 0.5, 2)
  return limit(o, 0.35)
}

/** The ISS is caught: a bright rising arpeggio. */
export function capture(): Float32Array {
  const o = buf(0.55)
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(o, i * 0.08, 0.24, f, f, 0.5, 2)
    tone(o, i * 0.08, 0.2, f * 2, f * 2, 0.12, 2.5)
  })
  return limit(o, 0.5)
}

/** A satellite hits the turtle: a dull thump with a burst of noise. */
export function bump(): Float32Array {
  const o = buf(0.32)
  tone(o, 0, 0.3, 140, 45, 0.9, 2.5)
  noise(o, 0, 0.12, 0.6, 0.2, (t) => (1 - t) ** 3, 7)
  return limit(o, 0.7)
}

/** A new satellite appears: a soft two-note blip. */
export function spawn(): Float32Array {
  const o = buf(0.25)
  tone(o, 0, 0.09, 880, 880, 0.5, 1.5)
  tone(o, 0.08, 0.16, 1318.5, 1318.5, 0.5, 2)
  return limit(o, 0.25)
}

/** The caught station falls and burns: a hissing swell with crackle, about as long as the burn (under a second). */
export function burn(): Float32Array {
  const o = buf(0.9)
  noise(o, 0, 0.9, 0.9, 0.1, (t) => Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 1.6, 11)
  noise(o, 0.1, 0.7, 0.35, 0.45, (t) => Math.sin(Math.PI * t) ** 2, 12)
  const rnd = mulberry32(13)
  for (let k = 0; k < 45; k++) { // crackle: tiny clicks scattered over the burn
    const at = rnd.uniform(0.05, 0.8)
    noise(o, at, 0.004, rnd.uniform(0.3, 0.8), 0.9, (t) => 1 - t, 100 + k)
  }
  return limit(o, 0.55)
}

/** The burn is over: a small pop. */
export function pop(): Float32Array {
  const o = buf(0.2)
  noise(o, 0, 0.15, 0.8, 0.5, (t) => (1 - t) ** 4, 21)
  tone(o, 0, 0.15, 320, 90, 0.5, 3)
  return limit(o, 0.45)
}

export const DRONE_SECONDS = 8

/** A quiet low hum for the background. It loops seamlessly: every partial has a whole number of cycles in 8 seconds. */
export function drone(): Float32Array {
  const o = buf(DRONE_SECONDS)
  const partials: Array<[number, number]> = [[55, 0.5], [82.5, 0.35], [110, 0.25], [165, 0.08]]
  for (let i = 0; i < o.length; i++) {
    const t = i / RATE
    let v = 0
    for (const [f, a] of partials) v += a * Math.sin(2 * Math.PI * f * t)
    o[i] = v * (0.75 + 0.25 * Math.sin((2 * Math.PI * t) / DRONE_SECONDS))
  }
  return limit(o, 0.5)
}

/** 16-bit mono PCM WAV file bytes. */
export function encodeWav(samples: Float32Array, rate = RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const dv = new DataView(bytes.buffer)
  const str = (at: number, s: string): void => [...s].forEach((c, i) => dv.setUint8(at + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  dv.setUint32(4, 36 + samples.length * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true) // PCM
  dv.setUint16(22, 1, true) // mono
  dv.setUint32(24, rate, true)
  dv.setUint32(28, rate * 2, true)
  dv.setUint16(32, 2, true)
  dv.setUint16(34, 16, true)
  str(36, 'data')
  dv.setUint32(40, samples.length * 2, true)
  samples.forEach((v, i) => dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true))
  return bytes
}
