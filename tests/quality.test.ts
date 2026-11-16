import { describe, expect, test } from 'vitest'
import { QUALITY_WAIT, QUALITY_WINDOW, QualityMonitor } from '../src/state/quality'

const feed = (m: QualityMonitor, ms: number, n: number): number => {
  let changes = 0
  for (let i = 0; i < n; i++) if (m.push(ms)) changes++
  return changes
}

describe('automatic quality', () => {
  test('a machine that keeps 60 fps never loses quality', () => {
    const m = new QualityMonitor()
    expect(feed(m, 1000 / 60, 5000)).toBe(0)
    expect(m.level).toBe(0)
  })

  test('a consistently slow machine drops one level at a time, down to minimal, and stops there', () => {
    const m = new QualityMonitor()
    const frames = QUALITY_WAIT + QUALITY_WINDOW * 4
    expect(feed(m, 50, frames)).toBe(3) // 20 fps
    expect(m.level).toBe(3)
    expect(feed(m, 50, 1000)).toBe(0)
  })

  test('nothing is judged during the start-up wait', () => {
    const m = new QualityMonitor()
    feed(m, 100, QUALITY_WAIT - 1)
    expect(m.level).toBe(0)
  })

  test('a few stalls do not count (median), and neither does a paused tab', () => {
    const m = new QualityMonitor()
    for (let i = 0; i < 1000; i++) m.push(i % 10 === 0 ? 200 : 16) // 10% hiccups
    expect(m.level).toBe(0)
    for (let i = 0; i < 1000; i++) m.push(5000) // hidden tab: ignored
    expect(m.level).toBe(0)
  })

  test('reset starts again from full quality', () => {
    const m = new QualityMonitor()
    feed(m, 50, QUALITY_WAIT + QUALITY_WINDOW)
    expect(m.level).toBeGreaterThan(0)
    m.reset()
    expect(m.level).toBe(0)
    expect(feed(m, 50, QUALITY_WAIT - 1)).toBe(0)
  })
})
