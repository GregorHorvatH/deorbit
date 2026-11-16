/** The land as one equirectangular texture, painted at start-up from the Natural Earth outlines (see
 *  scripts/build_terrain.py): no image assets. The ocean is NOT painted (it stays transparent) so the shader can switch
 *  the ocean and the land on and off separately. A straight line in (longitude, latitude) is a straight line on an
 *  equirectangular canvas, so the outlines are drawn as they are. There is no bright outline along the coast: the edge
 *  between the green land and the blue sea (and the lighter shelf in the shader) is clear enough on its own. */
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace } from 'three'
import { DESERTS } from './data/deserts'
import { GLACIERS } from './data/glaciers'
import { LAKES } from './data/lakes'
import { LAND } from './data/land'
import { RIVERS } from './data/rivers'
import { DESERT, GLACIER, LAND_FILL, RIVER } from './style'

/** River line width in texture pixels by rank (1 = the biggest). */
const RIVER_WIDTH: Record<number, number> = { 1: 2.6, 2: 2.0, 3: 1.5, 4: 1.2 }

type Rings = ReadonlyArray<ReadonlyArray<number>>

export function paintEarth(width = 4096, height = 2048): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const X = (lon: number): number => ((lon + 180) / 360) * width
  const Y = (lat: number): number => ((90 - lat) / 180) * height

  /** One path of all the rings of a polygon (the outline and its holes); fill it with the even-odd rule. */
  const path = (rings: Rings): Path2D => {
    const p = new Path2D()
    for (const r of rings) {
      for (let i = 0; i < r.length; i += 2) (i ? p.lineTo : p.moveTo).call(p, X(r[i]), Y(r[i + 1]))
      p.closePath()
    }
    return p
  }
  ctx.fillStyle = LAND_FILL
  for (const rings of LAND) ctx.fill(path(rings), 'evenodd')

  // everything below is painted only where there is land already ('source-atop'): the outlines of the deserts and
  // the rivers are rougher than the coast, and must never spill into the sea
  ctx.globalCompositeOperation = 'source-atop'
  /** A patch with a soft edge: the fill, then two wide, faint strokes that feather it into its surroundings. */
  const soft = (ring: ReadonlyArray<number>, color: string, alpha: number, feather: number): void => {
    const p = path([ring])
    ctx.fillStyle = ctx.strokeStyle = color
    ctx.lineJoin = 'round'
    ctx.globalAlpha = alpha * 0.3
    ctx.lineWidth = feather
    ctx.stroke(p)
    ctx.globalAlpha = alpha * 0.45
    ctx.lineWidth = feather * 0.5
    ctx.stroke(p)
    ctx.globalAlpha = alpha
    ctx.fill(p)
    ctx.globalAlpha = 1
  }
  for (const ring of DESERTS) soft(ring, DESERT, 0.8, 16)
  for (const ring of GLACIERS) soft(ring, GLACIER, 0.92, 8)
  ctx.strokeStyle = RIVER
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const r of [...RIVERS].sort((a, b) => b.rank - a.rank)) { // the big ones on top
    ctx.lineWidth = RIVER_WIDTH[r.rank] ?? 1
    ctx.beginPath()
    for (let i = 0; i < r.pts.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(r.pts[i]), Y(r.pts[i + 1]))
    ctx.stroke()
  }
  ctx.lineCap = 'butt'

  // lakes and inland seas are cut out of the land: the ocean shows through them
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = '#000'
  for (const rings of LAKES) ctx.fill(path(rings), 'evenodd')
  ctx.globalCompositeOperation = 'source-over'

  return canvas
}

export function makeEarthTexture(maxAnisotropy: number): CanvasTexture {
  const tex = new CanvasTexture(paintEarth())
  tex.colorSpace = NoColorSpace // plain display values, see style.ts
  tex.premultiplyAlpha = true // coasts blend with the ocean without a dark fringe
  tex.generateMipmaps = true
  tex.minFilter = LinearMipmapLinearFilter
  tex.magFilter = LinearFilter
  tex.anisotropy = maxAnisotropy
  return tex
}
