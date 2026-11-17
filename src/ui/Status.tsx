import { useLayoutEffect, useRef } from 'react'
import { useHud, useView } from '../state/hud'
import './status.css'

/** The ship's condition, top left: hull, fuel, the countdown of the orbit decay and the heart's timer. Plain HTML. */
export function Status() {
  const h = useHud()
  const top = useView((s) => s.touchTop)
  const scale = useView((s) => s.hudScale)
  const statusHeight = useView((s) => s.statusHeight)
  const rows = useRef<HTMLDivElement>(null)
  // measure the panel's natural height (the three rows plus its padding and border): the HUD plate is made as tall
  useLayoutEffect(() => {
    const box = rows.current?.parentElement
    if (!rows.current || !box) return
    const cs = getComputedStyle(box)
    const frame = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
    const natural = Math.ceil(rows.current.offsetHeight + frame)
    if (natural !== useView.getState().statusHeight) useView.setState({ statusHeight: natural })
  })
  const hidden = h.status === 'ready' // still laid out (so it can be measured), just not shown
  const decay = Math.ceil(h.decayIn)
  const low = h.fuel < h.fuelMax * 0.2
  return (
    <div
      className="status"
      aria-label="Ship status"
      aria-hidden={hidden}
      style={{ ...(top === null ? {} : { top, minHeight: Math.max(Math.round(111 * scale), statusHeight) }), ...(hidden ? { visibility: 'hidden' } : {}) }}
    >
      <div ref={rows}>
        <div className="status-row">
          <span className="status-name">HULL</span>
          <span className="status-hearts" aria-label={`${h.hull} of ${h.hullMax}`}>
            {Array.from({ length: h.hullMax }, (_, i) => (
              <span key={i} className={i < h.hull ? 'full' : 'empty'}>♥</span>
            ))}
          </span>
        </div>
        <div className="status-row">
          <span className="status-name">FUEL</span>
          <span className={`status-bar${low ? ' low' : ''}`} aria-label={`${Math.round(h.fuel)} of ${h.fuelMax}`}>
            <span style={{ width: `${(100 * h.fuel) / h.fuelMax}%` }} />
          </span>
          <span className={low ? 'status-warn' : 'status-num'}>{Math.round(h.fuel)}</span>
        </div>
        <div className="status-row">
          <span className="status-name">ORBIT</span>
          <span className={h.lowest ? 'status-warn' : h.warning || decay <= 5 ? 'status-amber' : 'status-num'}>
            {h.warning
              ? `${h.lowest ? 'DANGER' : 'SINKING'} ${decay}s`
              : h.lowest
                ? `RE-ENTRY IN ${decay}s`
                : `sinks in ${decay}s`}
          </span>
        </div>
      </div>
      {h.barrel && (
        <div className="status-row status-barrel">
          <span className="status-name">⛽</span>
          <span>catch the fuel</span>
        </div>
      )}
      {h.heart && (
        <div className="status-row status-heart">
          <span className="status-name">♥</span>
          <span>catch the heart</span>
        </div>
      )}
    </div>
  )
}
