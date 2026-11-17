import { CATCH_RADIUS, HUD_AIM, HUD_CLOSE, RADIUS_PX } from '../sim'
import { useHud, useView } from '../state/hud'
import { altColor } from './altColor'
import './hud.css'

const GREEN = 'var(--green)'
const AMBER = 'var(--amber)'
const TEXT = 'var(--text)'
const DIM = 'var(--dim)'

export const TOUCH_SIDE = 8 // px: the side margin of the HUD (right) and of the status panel (left) on a phone

const px = (r: number): number => Math.round(r * RADIUS_PX) // distances are shown in design pixels (a globe radius of 250)

function bearingText(b: number): string {
  return Math.abs(b) < 0.5 ? '0°' : `${b > 0 ? 'L' : 'R'}${Math.round(Math.abs(b))}°`
}

/** The table of instruments in the top-right corner, in plain HTML. */
export function Hud() {
  const h = useHud()
  const scale = useView((s) => s.hudScale)
  const top = useView((s) => s.touchTop)
  const statusHeight = useView((s) => s.statusHeight)
  const course = h.miss < CATCH_RADIUS ? GREEN : h.miss < 2 * CATCH_RADIUS ? AMBER : TEXT
  const alt = altColor(h.levelsOff)
  const cells = (label: string, labelColor: string, row: Array<[string, string]>): React.ReactNode => (
    <>
      <span style={{ color: labelColor }}>{label}</span>
      {row.map(([text, color], i) => (
        <span key={i} style={{ color }}>{text}</span>
      ))}
    </>
  )
  return (
    <div className="hud" style={{
        ['--s' as string]: scale,
        // phone: under the row of buttons, the same side margin as the status panel on the left, and as tall as that panel
        ...(top === null ? {} : { top, right: TOUCH_SIDE, height: Math.max(Math.round(111 * scale), statusHeight) }),
      }} aria-label="Instruments">
      <div className="hud-title">SCORE: {String(h.score).padStart(4, '0')}</div>
      <div className="hud-info">
        LVL {String(h.level).padStart(2, '0')}   SAT {String(h.sats).padStart(2, '0')}
      </div>
      <div className="hud-grid">
        <span />
        {['ALT', 'SPD', 'DST', 'BRG', 'ETA', 'MIS'].map((n) => (
          <span key={n} className="hud-head">{n}</span>
        ))}
        {cells('TUR', 'var(--turtle)', [
          [h.turAlt.toFixed(2), alt],
          [h.turSpeed.toFixed(1), TEXT],
          [String(px(h.dst)), h.dst < HUD_CLOSE * CATCH_RADIUS ? GREEN : TEXT],
          [bearingText(h.bearing), Math.abs(h.bearing) < HUD_AIM ? GREEN : TEXT],
          [h.eta === null ? '--' : `${h.eta.toFixed(1)}s`, h.eta === null ? DIM : course],
          [String(px(h.miss)), course],
        ])}
        {cells('ISS', AMBER, [
          [h.issAlt.toFixed(2), alt],
          [h.issSpeed.toFixed(1), TEXT],
          ['-', DIM], ['-', DIM], ['-', DIM], ['-', DIM],
        ])}
      </div>
    </div>
  )
}
