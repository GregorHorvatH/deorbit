import { BufferAttribute, BufferGeometry } from 'three'

/** A unit sphere whose vertex (lat, lon) sits where it is before the globe is rotated:
 *  x = cos(lat) sin(lon), y = sin(lat), z = cos(lat) cos(lon); uv = equirectangular (lon -180..180, lat 90..-90). */
export function makeGlobeGeometry(cols = 192, rows = 96): BufferGeometry {
  const pos = new Float32Array((cols + 1) * (rows + 1) * 3)
  const uv = new Float32Array((cols + 1) * (rows + 1) * 2)
  let i = 0
  for (let iy = 0; iy <= rows; iy++) {
    const lat = Math.PI / 2 - (Math.PI * iy) / rows
    for (let ix = 0; ix <= cols; ix++) {
      const lon = -Math.PI + (2 * Math.PI * ix) / cols
      pos.set([Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)], i * 3)
      uv.set([ix / cols, 1 - iy / rows], i * 2)
      i++
    }
  }
  const index: number[] = []
  const at = (iy: number, ix: number): number => iy * (cols + 1) + ix
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const a = at(iy, ix), b = at(iy + 1, ix), c = at(iy + 1, ix + 1), d = at(iy, ix + 1)
      index.push(a, b, c, a, c, d) // counter-clockwise seen from outside
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('uv', new BufferAttribute(uv, 2))
  g.setIndex(index)
  return g
}
