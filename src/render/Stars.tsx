import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Points } from 'three'
import { BufferAttribute, BufferGeometry, Color, ShaderMaterial } from 'three'
import { RADIUS_PX } from '../sim'
import { useSettings } from '../state/settings'
import { renderTick } from '../state/world'
import { starFrag, starVert } from './shaders'
import { makeStars } from './starData'

/** Twinkling background stars: one Points object, the twinkle runs in the vertex shader. */
export function Stars() {
  const on = useSettings((s) => s.layers.stars)
  const { geometry, material } = useMemo(() => {
    const stars = makeStars()
    const g = new BufferGeometry()
    const pos = new Float32Array(stars.length * 3)
    const col = new Float32Array(stars.length * 3)
    stars.forEach((s, i) => {
      pos.set([s.x, s.y, -3], i * 3)
      const c = new Color(s.color)
      col.set([c.r, c.g, c.b], i * 3)
    })
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aColor', new BufferAttribute(col, 3))
    g.setAttribute('aSize', new BufferAttribute(Float32Array.from(stars, (s) => s.size), 1))
    g.setAttribute('aPhase', new BufferAttribute(Float32Array.from(stars, (s) => s.phase), 1))
    g.setAttribute('aSpeed', new BufferAttribute(Float32Array.from(stars, (s) => s.speed), 1))
    g.boundingSphere = null
    const m = new ShaderMaterial({
      uniforms: { uTick: { value: 0 }, uScale: { value: 1 }, uTwinkle: { value: 1 } },
      vertexShader: starVert,
      fragmentShader: starFrag,
    })
    return { geometry: g, material: m }
  }, [])
  const points = useRef<Points>(null)
  const camera = useThree((s) => s.camera)
  const dpr = useThree((s) => s.viewport.dpr)
  useFrame(() => {
    const q = useSettings.getState().quality
    material.uniforms.uTwinkle.value = q >= 1 ? 0 : 1 // slow machine: no twinkling
    points.current!.visible = on && q < 3
    material.uniforms.uTick.value = renderTick()
    material.uniforms.uScale.value = (camera.zoom / RADIUS_PX) * dpr // window scale k, in device pixels
  })
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
}
