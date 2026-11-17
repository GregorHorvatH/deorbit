import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef } from 'react'
import { playEvents } from './audio/audio'
import { bindInput } from './input'
import { hudSnapshot } from './sim'
import { Atmosphere } from './render/Atmosphere'
import { Bloom } from './render/Bloom'
import { CameraRig } from './render/CameraRig'
import { Barrel } from './render/Barrel'
import { Cities } from './render/Cities'
import { Clouds } from './render/Clouds'
import { setWeatherMap } from './render/cloudUniforms'
import { FIRST_MORPH_SECONDS, MORPH_SECONDS } from './render/coverage'
import { Globe } from './render/Globe'
import { Heart } from './render/Heart'
import { Iss } from './render/Iss'
import { Overlay } from './render/Overlay'
import { Satellites } from './render/Satellites'
import { Stars } from './render/Stars'
import { BG } from './render/style'
import { Turtle } from './render/Turtle'
import { Wrecks } from './render/Wrecks'
import { useHud } from './state/hud'
import { QualityMonitor } from './state/quality'
import { realDeps, startWeather } from './state/weatherLoader'
import { useSettings } from './state/settings'
import { advance, world } from './state/world'
import { AltLabels, AltLabelsDriver } from './ui/AltLabels'
import { Hint } from './ui/Hint'
import { Hud } from './ui/Hud'
import { Panel } from './ui/Panel'
import { Screens } from './ui/Screens'
import { Status } from './ui/Status'
import { TouchControls } from './ui/TouchControls'

/** Drives the fixed-step simulation from the render loop, publishes the instruments to the HUD ~15 times a second,
 *  measures the FPS and lowers the graphics level when the machine cannot keep up. */
function Clock() {
  const size = useThree((s) => s.size)
  const monitor = useRef(new QualityMonitor())
  const acc = useRef({ hud: 0, frames: 0, fpsTime: 0, auto: true })
  useEffect(() => {
    monitor.current.reset() // a new window size: judge the quality again from scratch
    useSettings.setState((s) => (s.autoQuality ? { quality: 0 } : {}))
  }, [size.width, size.height])
  useFrame((_, dt) => {
    advance(dt)
    playEvents(world.game.events.splice(0)) // the simulation's events -> sound (a no-op until audio is unlocked)
    const a = acc.current
    a.hud += dt
    if (a.hud >= 1 / 15) {
      a.hud = 0
      useHud.setState(hudSnapshot(world.game))
    }
    a.frames++
    a.fpsTime += dt
    if (a.fpsTime >= 0.5) {
      useSettings.setState({ fps: Math.round(a.frames / a.fpsTime) })
      a.frames = 0
      a.fpsTime = 0
    }
    const { autoQuality } = useSettings.getState()
    if (autoQuality && !a.auto) monitor.current.reset() // auto-quality was just switched back on
    a.auto = autoQuality
    if (autoQuality && monitor.current.push(dt * 1000)) useSettings.setState({ quality: monitor.current.level })
  })
  return null
}

/** Keeps the clouds fed with real weather while "Live weather" is on. The first real map takes over quickly, every later
 *  one morphs in slowly: the clouds change where they are instead of being redrawn. */
function useWeatherFeed(): void {
  const live = useSettings((s) => s.liveWeather)
  useEffect(() => {
    if (!live) {
      setWeatherMap(null, FIRST_MORPH_SECONDS)
      useSettings.setState({ weather: { source: 'climate', time: '' } })
      return
    }
    let first = true
    return startWeather(
      realDeps(
        (map) => {
          setWeatherMap(map, first ? FIRST_MORPH_SECONDS : MORPH_SECONDS)
          first = false
        },
        (weather) => useSettings.setState({ weather }),
      ),
    )
  }, [live])
}

export default function App() {
  useEffect(() => bindInput(), [])
  useWeatherFeed()
  const panel = useSettings((s) => s.panelVisible)
  const game = useSettings((s) => s.layers.game)
  const quality = useSettings((s) => s.quality)
  // legacy + linear + flat: no colour management and no tone mapping - colours are plain display values, and the
  // night shade blends those plain numbers
  return (
    <div className="app">
      {panel && <Panel />}
      <div className="stage">
        <Canvas
          orthographic legacy linear flat
          dpr={[1, quality >= 2 ? 1 : 2]} // a slow machine also renders fewer pixels
          camera={{ position: [0, 0, 10], near: 0.1, far: 50 }}
        >
          <color attach="background" args={[BG]} />
          <Clock />
          <CameraRig game={game} />
          <Stars />
          <Suspense fallback={null}>
            <Globe />
          </Suspense>
          <Clouds />
          <Atmosphere />
          <Cities />
          <Satellites />
          <Iss />
          <Heart />
          <Barrel />
          <Turtle />
          <Wrecks />
          <Overlay />
          <AltLabelsDriver />
          <Bloom />
        </Canvas>
        {game && <AltLabels />}
        {game && <Hud />}
        <TouchControls />
        {game && <Status />}
        {game && <Hint />}
        <Screens />
      </div>
    </div>
  )
}
