import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, type Group, type OrthographicCamera, ShaderMaterial } from 'three'
import { RADIUS_PX, SPEED, TILT } from '../sim'
import { useSettings } from '../state/settings'
import { renderTick } from '../state/world'
import { makeCityLights } from './cityData'
import { cloudFrame } from './cloudFrame'
import { cloudUniforms } from './cloudUniforms'
import { GLOW_MASK, glowPass } from './glow'
import { cityFrag, cityVert } from './shaders'

/** City lights on the night side: tiny glowing squares riding on the globe, UNDER the clouds: a cloud covers the lights below it. */
export function Cities() {
  const camera = useThree((s) => s.camera) as OrthographicCamera
  const dpr = useThree((s) => s.viewport.dpr)
  const on = useSettings((s) => s.layers.cities)
  const night = useSettings((s) => s.layers.night)
  const quality = useSettings((s) => s.quality)
  const clouds = useSettings((s) => s.layers.clouds)
  const { geometry, material } = useMemo(() => {
    const lights = makeCityLights()
    // a soft glow square under every city core is drawn first, then every light on top of it
    const items = [...lights.filter((l) => l.core).map((l) => ({ ...l, halo: 1 })), ...lights.map((l) => ({ ...l, halo: 0 }))]
    const g = new BufferGeometry()
    const R = 1.004 // just above the ground, below the cloud shell (CLOUD_SCALE)
    g.setAttribute('position', new BufferAttribute(Float32Array.from(items.flatMap((l) => [l.x * R, l.y * R, l.z * R])), 3))
    g.setAttribute('aSize', new BufferAttribute(Float32Array.from(items, (l) => l.size), 1))
    g.setAttribute('aCore', new BufferAttribute(Float32Array.from(items, (l) => (l.core ? 1 : 0)), 1))
    g.setAttribute('aHalo', new BufferAttribute(Float32Array.from(items, (l) => l.halo), 1))
    g.setAttribute('aPhase', new BufferAttribute(Float32Array.from(items, (l) => l.phase), 1))
    g.boundingSphere = null
    const m = new ShaderMaterial({
      uniforms: { uTick: { value: 0 }, uScale: { value: 1 }, uNight: { value: 1 }, uCoresOnly: { value: 0 }, uGlowPass: glowPass,
        uCoverage: cloudUniforms.uCoverage, uToGround: cloudUniforms.uToGround, uCloudOct: cloudUniforms.uCloudOct, // the same clouds as the shell
        uCloudsOn: { value: 1 }, uWorldToCloud: { value: cloudFrame(0).worldToCloud } },
      vertexShader: cityVert,
      fragmentShader: cityFrag,
      transparent: true, // blended by their glow; sorted BEFORE the (also transparent) clouds, so clouds draw over them
      depthWrite: false,
    })
    return { geometry: g, material: m }
  }, [])
  useLayoutEffect(() => {
    material.uniforms.uNight.value = night ? 1 : 0
    material.uniforms.uCoresOnly.value = quality >= 2 ? 1 : 0 // slow machine: only the main light of each city
    material.uniforms.uCloudsOn.value = clouds && quality < 3 ? 1 : 0
  }, [material, night, quality, clouds])
  const spin = useRef<Group>(null)
  useFrame(() => {
    if (spin.current) spin.current.rotation.y = (renderTick() * SPEED) % (2 * Math.PI)
    material.uniforms.uWorldToCloud.value = cloudFrame(renderTick()).worldToCloud
    material.uniforms.uTick.value = renderTick()
    material.uniforms.uScale.value = (camera.zoom / RADIUS_PX) * dpr
  })
  return (
    <group rotation-x={TILT} visible={on && night && quality < 3}>
      <group ref={spin}>
        <points geometry={geometry} material={material} frustumCulled={false} renderOrder={-1} layers-mask={GLOW_MASK} />
      </group>
    </group>
  )
}
