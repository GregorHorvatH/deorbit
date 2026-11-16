import { describe, expect, test } from 'vitest'
import * as synth from '../src/audio/synth'
import { RATE } from '../src/audio/synth'

const peak = (a: Float32Array): number => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
const rms = (a: Float32Array, from = 0, to = a.length): number => Math.sqrt(a.slice(from, to).reduce((s, v) => s + v * v, 0) / (to - from))

const all: Array<[string, () => Float32Array, number]> = [
  ['tick', () => synth.tick(800), 0.06],
  ['capture', synth.capture, 0.55],
  ['bump', synth.bump, 0.32],
  ['spawn', synth.spawn, 0.25],
  ['burn', synth.burn, 0.9],
  ['pop', synth.pop, 0.2],
  ['drone', synth.drone, 8],
]

describe('synthesised sounds', () => {
  test.each(all)('%s: right length, finite, audible, never clipping', (_name, make, seconds) => {
    const s = make()
    expect(s.length).toBe(Math.round(seconds * RATE))
    expect(s.every(Number.isFinite)).toBe(true)
    expect(peak(s)).toBeGreaterThan(0.1)
    expect(peak(s)).toBeLessThanOrEqual(0.9)
  })

  test('deterministic: the same call gives the same samples', () => {
    expect(synth.burn()).toEqual(synth.burn())
  })

  test('the effects die away (no click at the end)', () => {
    for (const make of [synth.capture, synth.bump, synth.spawn, synth.pop, synth.burn]) {
      const s = make()
      expect(rms(s, s.length - 200)).toBeLessThan(rms(s) * 0.2)
    }
  })

  test('the burn swells and fades: its middle is louder than its start and end', () => {
    const b = synth.burn()
    const q = b.length >> 2
    expect(rms(b, q, 3 * q)).toBeGreaterThan(rms(b, 0, q / 4))
    expect(rms(b, q, 3 * q)).toBeGreaterThan(rms(b, b.length - q / 4))
  })

  test('the background hum loops without a click: the end continues into the start', () => {
    const d = synth.drone()
    const step = Math.abs(d[1] - d[0]) // a typical sample-to-sample step inside the hum
    expect(Math.abs(d[0] - d[d.length - 1])).toBeLessThan(Math.max(step * 3, 0.02))
  })

  test('WAV container: header, size, rate, 16-bit mono', () => {
    const s = synth.tick(800)
    const w = synth.encodeWav(s)
    const dv = new DataView(w.buffer)
    expect(String.fromCharCode(...w.slice(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...w.slice(8, 12))).toBe('WAVE')
    expect(w.length).toBe(44 + s.length * 2)
    expect(dv.getUint32(24, true)).toBe(RATE)
    expect(dv.getUint16(22, true)).toBe(1)
    expect(dv.getUint16(34, true)).toBe(16)
    expect(dv.getUint32(40, true)).toBe(s.length * 2)
  })
})
