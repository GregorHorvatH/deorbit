import { useHud } from '../state/hud'
import './status.css'

/** The ship's condition, top left: hull, fuel, the countdown of the orbit decay and the heart's timer. Plain HTML. */
export function Status() {
  const h = useHud()
  if (h.status === 'ready') return null
  const decay = Math.ceil(h.decayIn)
  const low = h.fuel < h.fuelMax * 0.2
  return (
    <div className="status" aria-label="Ship status">
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
            ? `${h.lowest ? 'DANGER' : 'SINKING'} ${decay}s: ${h.canHold ? 'press ↑ to hold' : 'no fuel to hold'}`
            : h.lowest
              ? `RE-ENTRY IN ${decay}s`
              : `sinks in ${decay}s`}
        </span>
      </div>
      {h.barrel !== null && (
        <div className="status-row status-barrel">
          <span className="status-name">⛽</span>
          <span>catch the fuel: {Math.ceil(h.barrel)}s</span>
        </div>
      )}
      {h.heart !== null && (
        <div className="status-row status-heart">
          <span className="status-name">♥</span>
          <span>catch the heart: {Math.ceil(h.heart)}s</span>
        </div>
      )}
    </div>
  )
}
