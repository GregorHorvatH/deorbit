import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import {
  AdditiveBlending, Color, LinearFilter, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2,
  WebGLRenderTarget,
} from 'three'
import { useSettings } from '../state/settings'
import { glowPass, GLOW_PASS_MASK } from './glow'

const BLOOM_STRENGTH = 1.5

const SCALE = 4 // the glow is rendered and blurred at 1/4 of the screen size: cheap, and a glow is soft anyway

const fullscreenVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`
const blurFrag = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uStep; // one texel * direction * radius
varying vec2 vUv;
void main() {
  vec3 c = texture2D(uTex, vUv).rgb * 0.227027;
  c += (texture2D(uTex, vUv + uStep).rgb + texture2D(uTex, vUv - uStep).rgb) * 0.1945946;
  c += (texture2D(uTex, vUv + uStep * 2.0).rgb + texture2D(uTex, vUv - uStep * 2.0).rgb) * 0.1216216;
  c += (texture2D(uTex, vUv + uStep * 3.0).rgb + texture2D(uTex, vUv - uStep * 3.0).rgb) * 0.054054;
  c += (texture2D(uTex, vUv + uStep * 4.0).rgb + texture2D(uTex, vUv - uStep * 4.0).rgb) * 0.016216;
  gl_FragColor = vec4(c, 1.0);
}`
const addFrag = /* glsl */ `
uniform sampler2D uTex;
uniform float uStrength;
varying vec2 vUv;
void main() { gl_FragColor = vec4(texture2D(uTex, vUv).rgb * uStrength, 1.0); }`

/** Selective bloom. The scene is drawn normally; then ONLY the glowing objects are drawn again into a small target,
 *  blurred, and added on top of the picture. Taking over the render (priority 1) is required: with bloom off it still
 *  draws the scene itself. */
export function Bloom() {
  const gl = useThree((s) => s.gl)
  const on = useSettings((s) => s.layers.bloom)
  const quality = useSettings((s) => s.quality)
  const g = useMemo(() => {
    const opts = { minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: true }
    const a = new WebGLRenderTarget(4, 4, opts)
    const b = new WebGLRenderTarget(4, 4, { ...opts, depthBuffer: false })
    const quadScene = new Scene()
    const quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const quad = new Mesh(new PlaneGeometry(2, 2))
    quad.frustumCulled = false
    quadScene.add(quad)
    const blur = new ShaderMaterial({ uniforms: { uTex: { value: null }, uStep: { value: new Vector2() } }, vertexShader: fullscreenVert, fragmentShader: blurFrag, depthTest: false, depthWrite: false })
    const add = new ShaderMaterial({
      uniforms: { uTex: { value: null }, uStrength: { value: BLOOM_STRENGTH } },
      vertexShader: fullscreenVert, fragmentShader: addFrag,
      blending: AdditiveBlending, transparent: true, depthTest: false, depthWrite: false,
    })
    return { a, b, quadScene, quadCam, quad, blur, add, size: new Vector2(), clear: new Color() }
  }, [])
  useEffect(() => () => {
    g.a.dispose()
    g.b.dispose()
    g.blur.dispose()
    g.add.dispose()
  }, [g])

  useFrame(({ scene, camera }) => {
    const active = on && quality < 1 // a slow machine does without the glow
    gl.setRenderTarget(null)
    gl.render(scene, camera) // the picture
    if (!active) return

    gl.getDrawingBufferSize(g.size)
    const w = Math.max(32, Math.round(g.size.x / SCALE))
    const h = Math.max(32, Math.round(g.size.y / SCALE))
    if (g.a.width !== w || g.a.height !== h) {
      g.a.setSize(w, h)
      g.b.setSize(w, h)
    }

    // 1. only the glowing things (+ the black occluders), on a transparent black background
    const bg = scene.background
    const mask = camera.layers.mask
    const prevAlpha = gl.getClearAlpha()
    gl.getClearColor(g.clear)
    scene.background = null
    camera.layers.mask = GLOW_PASS_MASK
    glowPass.value = 1
    gl.setRenderTarget(g.a)
    gl.setClearColor(0x000000, 0)
    gl.clear()
    gl.render(scene, camera)
    camera.layers.mask = mask
    glowPass.value = 0
    scene.background = bg
    gl.setClearColor(g.clear, prevAlpha)

    // 2. blur: horizontal + vertical, twice, the second time wider
    g.quad.material = g.blur
    const pass = (src: WebGLRenderTarget, dst: WebGLRenderTarget, dx: number, dy: number, radius: number): void => {
      g.blur.uniforms.uTex.value = src.texture
      g.blur.uniforms.uStep.value.set((dx * radius) / w, (dy * radius) / h)
      gl.setRenderTarget(dst)
      gl.render(g.quadScene, g.quadCam)
    }
    pass(g.a, g.b, 1, 0, 1)
    pass(g.b, g.a, 0, 1, 1)
    pass(g.a, g.b, 1, 0, 2.5)
    pass(g.b, g.a, 0, 1, 2.5)

    // 3. add the glow on top of the picture
    g.quad.material = g.add
    g.add.uniforms.uTex.value = g.a.texture
    gl.setRenderTarget(null)
    const auto = gl.autoClear
    gl.autoClear = false
    gl.render(g.quadScene, g.quadCam)
    gl.autoClear = auto
  }, 1)
  return null
}
