/** The relief map (scripts/build_relief.py) is decoded here with a tiny PNG reader and checked against places everyone
 *  knows: this catches a map that is upside down, mirrored or has its channels mixed up. */
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'

const file = new URL('../src/render/assets/relief.png', import.meta.url)

function decode(): { w: number; h: number; px: Uint8Array } {
  const b = readFileSync(file)
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  let off = 8
  let w = 0, h = 0
  const idat: Buffer[] = []
  while (off < b.length) {
    const len = b.readUInt32BE(off)
    const tag = b.subarray(off + 4, off + 8).toString('latin1')
    const data = b.subarray(off + 8, off + 8 + len)
    if (tag === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      expect([data[8], data[9]]).toEqual([8, 2]) // 8-bit RGB
    } else if (tag === 'IDAT') idat.push(data)
    off += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * 3
  const px = new Uint8Array(h * stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    for (let i = 0; i < stride; i++) {
      const v = raw[y * (stride + 1) + 1 + i]
      const left = i >= 3 ? px[y * stride + i - 3] : 0
      const up = y ? px[(y - 1) * stride + i] : 0
      px[y * stride + i] = f === 0 ? v : f === 1 ? v + left : f === 2 ? v + up : (() => { throw new Error('filter ' + f) })()
    }
  }
  return { w, h, px }
}

const map = decode()
/** [shade, height, depth] at a place (degrees). */
const at = (lat: number, lon: number): [number, number, number] => {
  const x = Math.min(map.w - 1, Math.floor(((lon + 180) / 360) * map.w))
  const y = Math.min(map.h - 1, Math.floor(((90 - lat) / 180) * map.h))
  const i = (y * map.w + x) * 3
  return [map.px[i], map.px[i + 1], map.px[i + 2]]
}

describe('relief map', () => {
  test('size, and light enough to ship', () => {
    expect([map.w, map.h]).toEqual([1440, 720])
    expect(readFileSync(file).length).toBeLessThan(1_000_000)
  })

  test('high ground is high (height channel)', () => {
    expect(at(28, 87)[1]).toBeGreaterThan(190) // Himalaya
    expect(at(33, 88)[1]).toBeGreaterThan(190) // Tibet
    expect(at(-15, -70)[1]).toBeGreaterThan(130) // Andes
    expect(at(-80, 30)[1]).toBeGreaterThan(100) // the Antarctic plateau
  })

  test('low ground is low', () => {
    expect(at(-5, -60)[1]).toBeLessThan(70) // Amazon basin
    expect(at(52, 20)[1]).toBeLessThan(70) // the North European plain
  })

  test('the deep sea is deep, the shelf is shallow (depth channel)', () => {
    expect(at(11, 142)[2]).toBeGreaterThan(220) // near the Mariana trench
    expect(at(0, -150)[2]).toBeGreaterThan(180) // the open Pacific
    expect(at(56, 3)[2]).toBeLessThan(60) // the North Sea
    expect(at(27, 51)[2]).toBeLessThan(60) // the Persian Gulf
  })

  test('land has no depth and sea has no height', () => {
    expect(at(24, 10)[2]).toBe(0) // Sahara
    expect(at(48, 2)[2]).toBe(0) // France
    expect(at(0, -150)[1]).toBe(0) // the Pacific
    expect(at(-30, -20)[1]).toBe(0) // the South Atlantic
  })

  test('hill shading: flat ground is neutral (128), mountains are not', () => {
    expect(at(0, -150)[0]).toBeGreaterThan(112)
    expect(at(0, -150)[0]).toBeLessThan(144)
    const ridge = [at(28, 84)[0], at(28, 85)[0], at(28, 86)[0], at(28, 87)[0], at(28, 88)[0], at(30, 86)[0]]
    expect(Math.max(...ridge) - Math.min(...ridge)).toBeGreaterThan(20)
  })
})
