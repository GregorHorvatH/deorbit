import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { type Group, ShaderMaterial } from 'three'
import { SPEED, TILT } from '../sim'
import { useSettings } from '../state/settings'
import { renderTick } from '../state/world'
import { cloudFrame } from './cloudFrame'
import { cloudUniforms, stepWeather } from './cloudUniforms'
import { OCCLUDER_MASK } from './glow'
import { cloudFrag, globeVert } from './shaders'
import { makeGlobeGeometry } from './sphere'
import { CLOUD_DRIFT, CLOUD_SCALE } from './style'

/** Clouds: a shell just above the surface that turns a little faster than the ground. The shape of the clouds is computed
 *  per pixel (noise shaped by a weather map), so there is no texture to run out of resolution and no seam to hide. */
export function Clouds() {
  const on = useSettings((s) => s.layers.clouds)
  const night = useSettings((s) => s.layers.night)
  const quality = useSettings((s) => s.quality)
  const geometry = useMemo(() => makeGlobeGeometry(128, 64), [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { ...cloudUniforms, uNight: { value: 1 }, uDetail: { value: 1 }, uBlack: { value: 0 } },
        vertexShader: globeVert,
        fragmentShader: cloudFrag,
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
      }),
    [],
  )
  // the same clouds in black: seen only by the glow pass, so a light under a cloud does not shine through it
  const occluder = useMemo(() => {
    const m = material.clone()
    m.uniforms = { ...material.uniforms, uBlack: { value: 1 } } // shares the weather map and the other uniforms
    return m
  }, [material])
  useLayoutEffect(() => {
    material.uniforms.uNight.value = night ? 1 : 0
    material.uniforms.uDetail.value = quality >= 1 ? 0 : 1 // slow machine: no self-shading ...
    cloudUniforms.uCloudOct.value = quality >= 1 ? 3 : 5 // ... and a plainer shape
  }, [material, night, quality])
  const spin = useRef<Group>(null)
  useFrame(() => {
    stepWeather() // a new weather map takes over smoothly (see MORPH_SECONDS)
    const tick = renderTick()
    if (spin.current) spin.current.rotation.y = (tick * SPEED * CLOUD_DRIFT) % (2 * Math.PI)
    const f = cloudFrame(tick)
    cloudUniforms.uToGround.value = f.toGround
    cloudUniforms.uSunCloud.value = f.sun
    material.uniforms.uSunCloud.value = f.sun
  })
  return (
    <group rotation-x={TILT} visible={on && quality < 3}>
      <group ref={spin}>
        <mesh geometry={geometry} material={material} scale={CLOUD_SCALE} renderOrder={0} />
        <mesh geometry={geometry} material={occluder} scale={CLOUD_SCALE} renderOrder={0} layers-mask={OCCLUDER_MASK} />
      </group>
    </group>
  )
}
