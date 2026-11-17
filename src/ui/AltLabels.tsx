import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { OrthographicCamera } from 'three'
import { activeSatellites, onOrbit, PLAYER_ALT_STEP, RADIUS_PX, SATELLITE_COUNT } from '../sim'
import { issAt, playerAt } from '../render/interp'
import { renderTick, world } from '../state/world'
import { altColor } from './altColor'
import './altLabels.css'

/** One label per thing that can fly: the satellites first, then the ISS, the heart, the barrel and the turtle. */
const ISS = SATELLITE_COUNT
const HEART = SATELLITE_COUNT + 1
const BARREL = SATELLITE_COUNT + 2
const TURTLE = SATELLITE_COUNT + 3
const LABELS = SATELLITE_COUNT + 4

/** The label elements, shared between the DOM part (which creates them) and the part inside the canvas (which moves them). */
const host: { labels: HTMLSpanElement[]; root: HTMLDivElement | null } = { labels: [], root: null }

/** The altitude (1.24) next to every object on an orbit. The turtle's (and the ISS's) value is coloured like the HUD's ALT column. */
export function AltLabels() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    host.root = root.current
    host.labels = root.current ? Array.from(root.current.children) as HTMLSpanElement[] : []
    return () => {
      host.root = null
      host.labels = []
    }
  }, [])
  return (
    <div ref={root} className="alt-labels" aria-hidden="true">
      {Array.from({ length: LABELS }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  )
}

/** Inside the canvas: projects the objects to the screen every frame and writes the labels. */
export function AltLabelsDriver() {
  const camera = useThree((s) => s.camera) as OrthographicCamera
  const size = useThree((s) => s.size)
  const last = useRef<string[]>([])
  useFrame(() => {
    const { labels } = host
    if (labels.length !== LABELS) return
    const g = world.game
    const k = camera.zoom / RADIUS_PX
    const font = Math.max(8, Math.round(10 * Math.min(1, k)))
    if (host.root) host.root.style.fontSize = `${font}px`
    const levelsOff = Math.round(Math.abs(g.player.alt - g.iss.r) / PLAYER_ALT_STEP)
    const match = altColor(levelsOff)
    const show = (i: number, pos: readonly [number, number, number], alt: number, color: string | null, dx: number): void => {
      const el = labels[i]
      const text = alt.toFixed(2)
      if (last.current[i] !== text) {
        el.textContent = text
        last.current[i] = text
      }
      el.style.display = 'block'
      el.style.opacity = pos[2] >= 0 ? '1' : '0.4' // behind the Earth: dim, like the objects themselves
      el.style.color = color ?? ''
      const x = size.width / 2 + pos[0] * camera.zoom + dx * Math.max(k, 0.5)
      const y = size.height / 2 - (pos[1] - camera.position.y) * camera.zoom
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translateY(-50%)`
    }
    const hide = (i: number): void => {
      labels[i].style.display = 'none'
    }

    const n = g.layers.game && g.layers.sats ? activeSatellites(g) : 0
    const tick = renderTick()
    for (let i = 0; i < SATELLITE_COUNT; i++) {
      if (i >= n) {
        hide(i)
        continue
      }
      const { r, u, v, omega, phase } = g.orbits[i]
      show(i, onOrbit(r, u, v, phase + omega * tick), r, null, 16)
    }
    if (g.layers.game && g.layers.iss) show(ISS, issAt(g, world.alpha), g.iss.r, match, 28)
    else hide(ISS)
    const heart = g.layers.game ? g.heart : null
    if (heart) show(HEART, onOrbit(heart.r, heart.u, heart.v, heart.theta + heart.omega * world.alpha), heart.r, null, 20)
    else hide(HEART)
    const barrel = g.layers.game ? g.barrel : null
    if (barrel) show(BARREL, onOrbit(barrel.r, barrel.u, barrel.v, barrel.theta + barrel.omega * world.alpha), barrel.r, null, 20)
    else hide(BARREL)
    if (g.layers.game && g.status !== 'lost') show(TURTLE, playerAt(g, world.alpha).pos, g.player.alt, match, 16)
    else hide(TURTLE)
  })
  return null
}
