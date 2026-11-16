import { CATCH_RADIUS, HUD_AIM, HUD_CLOSE, PLAYER_TURN_STEP, RADIUS_PX } from '../sim'
import { GRAPHICS_NAMES, LAYERS, useSettings } from '../state/settings'
import './panel.css'

const px = (r: number): number => Math.round(r * RADIUS_PX)

/** The control panel: live FPS, the graphics level, a checkbox per layer, the auto-quality
 *  switch and the legend of the HUD. A column next to the picture, not an overlay; H hides it. */
export function Panel() {
  const { layers, autoQuality, quality, fps, ambient, music, sfx, liveWeather, weather, setLayer, setAutoQuality, setAmbient, setMusic, setSfx, setLiveWeather } = useSettings()
  const turn = Math.round((PLAYER_TURN_STEP * 180) / Math.PI)
  const graphics = GRAPHICS_NAMES[quality] + (quality && autoQuality ? ' (auto)' : '')
  const legend: Array<[string, string]> = [
    ['LVL', 'level = caught ISS + 1'],
    ['SAT', 'satellites flying now'],
    ['ISS', 'the station you chase'],
    ['TUR', 'your turtle'],
    ['ALT', 'altitude; green = same level, amber = 1-2 apart'],
    ['SPD', 'orbital speed, degrees per second'],
    ['DST', `distance to the ISS, px; green < ${px(HUD_CLOSE * CATCH_RADIUS)}`],
    ['BRG', `L / R + degrees; green < ${HUD_AIM} = ahead`],
    ['ETA', 'secs to closest pass (no keys); -- = apart'],
    ['MIS', `miss, px; green < ${px(CATCH_RADIUS)} = hit, amber < ${px(2 * CATCH_RADIUS)}`],
  ]
  return (
    <aside className="panel">
      <div className="panel-fps">{fps} FPS</div>
      <div className="panel-dim">Graphics: {graphics}</div>

      <h2>LAYERS</h2>
      {LAYERS.map(([key, label]) => (
        <label key={key}>
          <input type="checkbox" checked={layers[key]} onChange={(e) => setLayer(key, e.target.checked)} />
          {label}
        </label>
      ))}
      <hr />
      <label>
        <input type="checkbox" checked={autoQuality} onChange={(e) => setAutoQuality(e.target.checked)} />
        Auto-reduce graphics
      </label>
      <label>
        <input type="checkbox" checked={liveWeather} onChange={(e) => setLiveWeather(e.target.checked)} />
        Live weather (clouds)
      </label>
      <p className="panel-dim panel-note">
        {weather.source === 'live'
          ? `Clouds: live, ${weather.time.replace('T', ' ')} UTC`
          : !liveWeather
            ? 'Clouds: climate guess'
            : weather.failed
              ? 'Clouds: live weather unavailable, trying again later (climate guess)'
              : 'Clouds: loading... (climate guess)'}
        {' · '}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data by Open-Meteo.com</a>
      </p>
      <hr />
      <label>
        <input type="checkbox" checked={ambient} onChange={(e) => setAmbient(e.target.checked)} />
        Background sound
      </label>
      <label>
        <input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} />
        Music
      </label>
      <label>
        <input type="checkbox" checked={sfx} onChange={(e) => setSfx(e.target.checked)} />
        Other sounds
      </label>
      <hr />

      <h2>GAME</h2>
      <p>
        Catch the ISS with the turtle.
        <br />
        Left / Right - turn the orbit ({turn} deg)
        <br />
        Up / Down - raise / lower it (one step)
        <br />
        Each catch: faster ISS + one more satellite
      </p>
      <hr />

      <h2>HUD (top right)</h2>
      <dl>
        {legend.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="panel-dim">F - fullscreen &nbsp; H - hide panel &nbsp; M - mute / unmute all</p>
    </aside>
  )
}
