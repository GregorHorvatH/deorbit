import { useMemo } from 'react'
import { Color, ShaderMaterial } from 'three'
import { ATMO_WIDTH } from '../sim'
import { useSettings } from '../state/settings'
import { atmoFrag, atmoVert } from './shaders'
import { ATMO_COLOR } from './style'

/** The glow around the globe: a screen-aligned plane at z = 0 that only shows outside the disc, so objects behind the
 *  Earth (z < 0) are tinted by it and objects in front are not. */
export function Atmosphere() {
  const night = useSettings((s) => s.layers.night)
  const on = useSettings((s) => s.layers.atmo)
  const quality = useSettings((s) => s.quality)
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uColor: { value: new Color(ATMO_COLOR) }, uNight: { value: night ? 1 : 0 } },
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        transparent: true,
        depthWrite: false,
      }),
    [night],
  )
  const size = 2 * (1 + ATMO_WIDTH)
  return (
    <mesh material={material} renderOrder={1} visible={on && quality < 2}>
      <planeGeometry args={[size, size]} />
    </mesh>
  )
}
