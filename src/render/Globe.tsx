import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, LinearFilter, LinearMipmapLinearFilter, type Group, MeshBasicMaterial, NoColorSpace, ShaderMaterial, TextureLoader } from 'three'
import { SPEED, TILT } from '../sim'
import { useSettings } from '../state/settings'
import { renderTick } from '../state/world'
import { makeEarthTexture } from './earthTexture'
import { globeFrag, globeVert } from './shaders'
import reliefUrl from './assets/relief.png?url'
import { cloudFrame } from './cloudFrame'
import { cloudUniforms } from './cloudUniforms'
import { OCCLUDER_MASK } from './glow'
import { makeGlobeGeometry } from './sphere'
import { OCEAN } from './style'

/** The Earth: tilted about X, turning about its own axis. */
export function Globe() {
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const { ocean, land, night, terrain, clouds } = useSettings((s) => s.layers)
  const quality = useSettings((s) => s.quality)
  const relief = useLoader(TextureLoader, reliefUrl) // suspends until it is loaded (see App.tsx)
  const geometry = useMemo(() => makeGlobeGeometry(), [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uMap: { value: makeEarthTexture(maxAniso) },
          uRelief: { value: relief },
          uTerrain: { value: 1 },
          ...cloudUniforms, // the weather map, the way to the ground frame and the octaves: the SAME clouds as the shell
          uToCloud: { value: cloudFrame(0).toCloud },
          uSunCloud: { value: cloudFrame(0).sun },
          uCloudShadow: { value: 1 },
          uOcean: { value: new Color(OCEAN) },
          uNight: { value: 1 },
          uOceanOn: { value: 1 },
          uLandOn: { value: 1 },
        },
        vertexShader: globeVert,
        fragmentShader: globeFrag,
      }),
    [maxAniso, relief],
  )
  useLayoutEffect(() => {
    relief.colorSpace = NoColorSpace // plain numbers, not colours
    relief.minFilter = LinearMipmapLinearFilter
    relief.magFilter = LinearFilter
    relief.generateMipmaps = true
    relief.anisotropy = maxAniso
    relief.needsUpdate = true
  }, [relief, maxAniso])
  useLayoutEffect(() => {
    material.uniforms.uTerrain.value = terrain && quality < 2 ? 1 : 0 // a slow machine draws flat colours
    material.uniforms.uCloudShadow.value = clouds && quality < 1 ? 1 : 0 // cloud shadows cost a second cloud lookup per pixel
    material.uniforms.uNight.value = night ? 1 : 0
    material.uniforms.uOceanOn.value = ocean ? 1 : 0
    material.uniforms.uLandOn.value = land ? 1 : 0
  }, [material, ocean, land, night, terrain, clouds, quality])
  const occluder = useMemo(() => new MeshBasicMaterial({ color: 0x000000 }), [])
  const spin = useRef<Group>(null)
  useFrame(() => {
    // the rotation advances SPEED per simulation step; render between steps for smooth motion at any refresh rate
    const tick = renderTick()
    if (spin.current) spin.current.rotation.y = (tick * SPEED) % (2 * Math.PI)
    const f = cloudFrame(tick)
    material.uniforms.uToCloud.value = f.toCloud
    material.uniforms.uSunCloud.value = f.sun
  })
  return (
    <group rotation-x={TILT} visible={ocean || land}>
      <group ref={spin}>
        <mesh geometry={geometry} material={material} />
        <mesh geometry={geometry} material={occluder} layers-mask={OCCLUDER_MASK} />
      </group>
    </group>
  )
}
