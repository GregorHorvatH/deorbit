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

// ------------------------------------------------------------------ music
// An original piece in the spirit of a big, slow, organ-and-arpeggio space score: a swelling organ pad, a rolling
// ostinato of soft plucks, one lonely high line, a deep pedal bass and a long hall. It is NOT a copy of any existing
// tune. 32 seconds, four chords of 8 seconds (three bars each at 90 BPM), and every sound that rings past the end
// wraps around to the start, so it loops without a seam.

export const MUSIC_SECONDS = 32
const BPM = 90
const EIGHTH = 60 / BPM / 2
const CHORD_SECONDS = MUSIC_SECONDS / 4
const BARS_PER_CHORD = 3
const PAD_FADE = 2.4

const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)
const smooth = (x: number): number => {
  const c = Math.max(0, Math.min(1, x))
  return c * c * (3 - 2 * c)
}
const wrap = (i: number, n: number): number => ((i % n) + n) % n

interface Chord {
  /** the pedal note (MIDI) */
  bass: number
  /** the organ chord */
  pad: readonly number[]
  /** the four notes the ostinato rolls over */
  arp: readonly number[]
  /** the long high note */
  melody: number
}

/** A minor with open, added-note chords: Am9, Fmaj9, Cadd9, Gsus2 - and round again. */
const CHORDS: readonly Chord[] = [
  { bass: 33, pad: [45, 52, 57, 60, 64], arp: [69, 72, 76, 71], melody: 76 },
  { bass: 29, pad: [41, 48, 57, 60, 64], arp: [69, 72, 76, 77], melody: 77 },
  { bass: 36, pad: [48, 55, 60, 64, 67], arp: [72, 74, 76, 79], melody: 79 },
  { bass: 31, pad: [43, 50, 55, 59, 62], arp: [71, 74, 79, 76], melody: 83 },
]
/** which of the four arp notes each eighth plays; the last bar of a chord turns the pattern round */
const ARP_PATTERN = [0, 1, 2, 3, 2, 1, 2, 3]
const ARP_TURN = [0, 2, 1, 3, 1, 2, 3, 2]

/** Adds a stack of sine partials [multiple of freq, amplitude] with the envelope env(seconds since the start),
 *  WRAPPING past the end of the buffer (so the music loops). Each partial is a rotating phasor: no sin() per sample. */
function voice(out: Float32Array, start: number, dur: number, freq: number, partials: ReadonlyArray<readonly [number, number]>, env: (t: number) => number): void {
  const n = Math.round(dur * RATE)
  const i0 = Math.round(start * RATE)
  const k = partials.length
  const c = new Float64Array(k)
  const s = new Float64Array(k)
  const x = new Float64Array(k).fill(1)
  const y = new Float64Array(k)
  partials.forEach(([m], j) => {
    c[j] = Math.cos((2 * Math.PI * freq * m) / RATE)
    s[j] = Math.sin((2 * Math.PI * freq * m) / RATE)
  })
  for (let i = 0; i < n; i++) {
    let v = 0
    for (let j = 0; j < k; j++) {
      const nx = x[j] * c[j] - y[j] * s[j]
      y[j] = x[j] * s[j] + y[j] * c[j]
      x[j] = nx
      v += partials[j][1] * y[j]
    }
    out[wrap(i0 + i, out.length)] += v * env(i / RATE)
  }
}

/** A circular comb filter (an echo that feeds back), run until the wrap-around has settled. */
function comb(src: Float32Array, delay: number, feedback: number): Float32Array {
  const n = src.length
  const d = Math.round(delay * RATE)
  const y = Float32Array.from(src)
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < n; i++) y[i] = src[i] + feedback * y[wrap(i - d, n)]
  return y
}

/** The music loop (mono). Deterministic. */
export function music(): Float32Array {
  const n = Math.round(MUSIC_SECONDS * RATE)
  const pad = new Float32Array(n)
  const arp = new Float32Array(n)
  const line = new Float32Array(n)

  CHORDS.forEach((chord, ci) => {
    const t0 = ci * CHORD_SECONDS
    // organ + pedal: a slow swell that crosses into the next chord on the bar line
    const dur = CHORD_SECONDS + PAD_FADE
    const swell = (t: number): number => smooth(t / PAD_FADE) * smooth((dur - t) / PAD_FADE)
    for (const note of chord.pad) {
      for (const cents of [-6, 6]) {
        voice(pad, t0 - PAD_FADE / 2, dur, hz(note) * 2 ** (cents / 1200), [[1, 0.5], [2, 0.3], [3, 0.14]], (t) => 0.22 * swell(t))
      }
    }
    voice(pad, t0 - PAD_FADE / 2, dur, hz(chord.bass), [[1, 1], [2, 0.35], [3, 0.1]], (t) => 0.9 * swell(t))

    // the rolling ostinato of soft plucks, with the pedal's octave on the first beat
    for (let bar = 0; bar < BARS_PER_CHORD; bar++) {
      const pattern = bar === BARS_PER_CHORD - 1 ? ARP_TURN : ARP_PATTERN
      pattern.forEach((idx, e) => {
        const at = t0 + (bar * 8 + e) * EIGHTH
        const amp = e % 4 === 0 ? 1 : 0.65
        voice(arp, at, 1.8, hz(chord.arp[idx]), [[1, 1], [2, 0.28], [3, 0.1]], (t) => amp * (t < 0.006 ? t / 0.006 : Math.exp(-(t - 0.006) * 3.4)))
      })
      voice(arp, t0 + bar * 8 * EIGHTH, 2.4, hz(chord.arp[0] - 12), [[1, 1], [2, 0.2]], (t) => 0.8 * (t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) * 2.2)))
    }

    // one long, lonely high note per chord, with a late, shy vibrato
    const lineStart = t0 + 1.2
    const lineDur = 6
    const f = hz(chord.melody)
    let phase = 0
    for (let i = 0; i < Math.round(lineDur * RATE); i++) {
      const t = i / RATE
      const vib = 1 + 0.004 * smooth((t - 1.5) / 1.5) * Math.sin(2 * Math.PI * 5.2 * t)
      phase += (2 * Math.PI * f * vib) / RATE
      line[wrap(Math.round(lineStart * RATE) + i, n)] += (Math.sin(phase) + 0.2 * Math.sin(2 * phase)) * smooth(t / 1.8) * smooth((lineDur - t) / 2.4)
    }
  })

  // a long hall for the plucks and the line: three feedback echoes, warmed with a one-pole low-pass
  const wet = new Float32Array(n)
  const source = new Float32Array(n)
  for (let i = 0; i < n; i++) source[i] = arp[i] * 0.7 + line[i] * 0.6
  for (const [d, fb] of [[0.37, 0.62], [0.53, 0.58], [0.71, 0.54]] as const) {
    const c = comb(source, d, fb)
    for (let i = 0; i < n; i++) wet[i] += c[i] / 3
  }
  let lp = 0
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    lp += 0.3 * (wet[i] - lp)
    const t = i / RATE
    const gain = 0.75 - 0.25 * Math.cos((2 * Math.PI * t) / MUSIC_SECONDS) // the whole piece breathes once per loop
    out[i] = (pad[i] * 0.55 + arp[i] * 0.3 + line[i] * 0.22 + lp * 0.9) * gain
  }
  return limit(out, 0.7)
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
