import { cloudFrame } from './cloudFrame'
import { analyticCoverage, CoverageBlender, makeCoverageTexture, MORPH_SECONDS } from './coverage'

const blender = new CoverageBlender(analyticCoverage())

/** The uniforms the cloud shell and the globe's cloud shadows share, so both see the same clouds. */
export const cloudUniforms = {
  uCoverage: { value: makeCoverageTexture(blender.data) },
  uToGround: { value: cloudFrame(0).toGround },
  uSunCloud: { value: cloudFrame(0).sun },
  uCloudOct: { value: 5 },
}

const seconds = (): number => performance.now() / 1000

/** A new weather map (null = the climate guess): the clouds morph into it over `morph` seconds. */
export function setWeatherMap(map: Uint8Array | null, morph: number = MORPH_SECONDS): void {
  blender.set(map ?? analyticCoverage(), morph, seconds())
}

/** Call every frame: moves the weather map along while a morph is running. */
export function stepWeather(): void {
  if (blender.step(seconds())) cloudUniforms.uCoverage.value.needsUpdate = true
}
