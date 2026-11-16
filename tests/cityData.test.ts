import { describe, expect, test } from 'vitest'
import { makeCityLights, makeCoastLights, makeRiverLights } from '../src/render/cityData'
import { mulberry32 } from '../src/sim'
import { distToCoast, inDesert, inLand } from '../src/render/geo'

const toLatLon = (l: { x: number; y: number; z: number }): [number, number] => [
  (Math.asin(l.y) * 180) / Math.PI,
  (Math.atan2(l.x, l.z) * 180) / Math.PI,
]

describe('city lights', () => {
  const lights = makeCityLights()
  const dots = lights.filter((l) => !l.core)
  const cores = lights.filter((l) => l.core)

  test('deterministic', () => expect(makeCityLights()).toEqual(lights))

  test('every light is on land, none on the sea (a port city may sit right on the shore)', () => {
    for (const l of dots) expect(inLand(...toLatLon(l))).toBe(true)
    for (const l of cores) {
      const [la, lo] = toLatLon(l)
      expect(inLand(la, lo) || distToCoast(la, lo) < 0.4).toBe(true)
    }
  })

  test('the cities stay, and the other lights are plenty', () => {
    expect(cores.length).toBeGreaterThan(100)
    expect(dots.length).toBeGreaterThan(600)
  })

  // the coast lights alone (the river lights are inland by design)
  const coast = makeCoastLights(mulberry32(21)).filter(([la, lo]) => inLand(la, lo))

  test('most coast lights hug the coasts', () => {
    expect(coast.length).toBeGreaterThan(500)
    const near = coast.filter(([la, lo]) => distToCoast(la, lo) < 2).length
    expect(near / coast.length).toBeGreaterThan(0.8)
  })

  test('only a few coast lights sit well inside the continents', () => {
    const deep = coast.filter(([la, lo]) => distToCoast(la, lo) > 4).length
    expect(deep / coast.length).toBeLessThan(0.12)
  })

  test('river lights exist, and sit on land', () => {
    const river = makeRiverLights(mulberry32(21))
    expect(river.length).toBeGreaterThan(40)
    expect(river.filter(([la, lo]) => inLand(la, lo)).length / river.length).toBeGreaterThan(0.8)
  })

  test('Antarctica stays dark', () => {
    expect(lights.filter((l) => toLatLon(l)[0] < -62).length).toBe(0)
  })

  test('the coasts of every populated continent are marked', () => {
    const box = (lat0: number, lat1: number, lon0: number, lon1: number): number =>
      dots.filter((l) => { const [la, lo] = toLatLon(l); return la > lat0 && la < lat1 && lo > lon0 && lo < lon1 }).length
    expect(box(10, 60, -130, -60)).toBeGreaterThan(30) // North America
    expect(box(-55, 10, -85, -35)).toBeGreaterThan(30) // South America
    expect(box(-35, 35, -18, 52)).toBeGreaterThan(30) // Africa
    expect(box(35, 70, -10, 40)).toBeGreaterThan(20) // Europe
    expect(box(-40, -10, 112, 154)).toBeGreaterThan(10) // Australia
  })
})

describe('terrain data', () => {
  test('seas and lakes the old hand-made outlines got wrong are water now', () => {
    const water: Array<[string, number, number]> = [['Mediterranean', 35, 18], ['Black Sea', 43.5, 34], ['Caspian', 42, 51], ['Baltic', 58, 19],
      ['Lake Michigan', 44, -87], ['Lake Victoria', -1, 33], ['Baikal', 53.5, 108], ['Hudson Bay', 60, -85], ['Red Sea', 20, 38]]
    for (const [name, lat, lon] of water) expect(inLand(lat, lon), name).toBe(false)
  })

  test('and the land is land', () => {
    const land: Array<[string, number, number]> = [['Sahara', 24, 10], ['Paris', 48.9, 2.3], ['Siberia', 62, 100], ['Amazon basin', -5, -60],
      ['Outback', -25, 133], ['Texas', 31, -99], ['Madagascar', -19, 47], ['Greenland', 72, -40], ['Antarctica', -80, 30]]
    for (const [name, lat, lon] of land) expect(inLand(lat, lon), name).toBe(true)
  })

  test('deserts are where deserts are', () => {
    expect(inDesert(24, 10)).toBe(true) // Sahara
    expect(inDesert(43, 105)).toBe(true) // Gobi
    expect(inDesert(48.9, 2.3)).toBe(false) // Paris
    expect(inDesert(-5, -60)).toBe(false) // Amazon
  })
})

describe('lights follow the terrain', () => {
  const lights = makeCityLights()
  const dots = lights.filter((l) => !l.core)
  const at = (l: { x: number; y: number; z: number }): [number, number] => toLatLon(l)

  test('the Nile valley is a line of light through the Sahara', () => {
    const valley = dots.filter((l) => { const [la, lo] = at(l); return la > 22 && la < 31.5 && lo > 30 && lo < 33.5 })
    expect(valley.length).toBeGreaterThan(12)
  })

  test('the deserts themselves stay dark: few lights inside them', () => {
    const inDes = dots.filter((l) => inDesert(...at(l))).length
    expect(inDes / dots.length).toBeLessThan(0.1)
  })
})
