/** Automatic quality. Watches the real frame intervals and, if the machine cannot
 *  keep up, drops one detail level. It judges the MEDIAN of the last WINDOW frames, so a one-off stall (a dragged
 *  window, a background tab, the slow first frames) never triggers it - only a consistently low frame rate does.
 *  Levels: 0 full ... 3 minimal. It only ever goes down; it starts again from full when the window size changes. */

export const QUALITY_WINDOW = 90 // frames in the median
export const QUALITY_MIN_FPS = 40 // below this (median) the next, simpler level is used
export const QUALITY_WAIT = 60 // frames to wait at start-up (or after a change) before judging
export const MAX_QUALITY = 3
const IGNORE_ABOVE_MS = 500 // a longer gap is a pause (hidden tab), not slowness

export class QualityMonitor {
  level = 0
  private recent: number[] = []
  private wait = QUALITY_WAIT

  /** Feeds one real frame interval (ms). Returns true when the level changed. */
  push(ms: number): boolean {
    if (this.level >= MAX_QUALITY || ms > IGNORE_ABOVE_MS) return false
    this.recent.push(ms)
    if (this.recent.length > QUALITY_WINDOW) this.recent.shift()
    this.wait--
    if (this.wait <= 0 && this.recent.length >= QUALITY_WINDOW) {
      const median = [...this.recent].sort((a, b) => a - b)[this.recent.length >> 1]
      if (median > 1000 / QUALITY_MIN_FPS) {
        this.level++
        this.wait = QUALITY_WINDOW
        this.recent = []
        return true
      }
    }
    return false
  }

  /** The window size changed (or auto-quality was switched on): judge again from scratch at full quality. */
  reset(): void {
    this.level = 0
    this.recent = []
    this.wait = QUALITY_WAIT
  }
}
