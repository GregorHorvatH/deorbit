import { create } from 'zustand'

/** The best result, remembered between visits: the most stations caught, and the fastest win. */
interface Best {
  score: number
  /** seconds of the fastest win, null = never won */
  time: number | null
  /** the last recorded result set a record (for the end screen) */
  fresh: boolean
  record: (score: number, seconds: number, won: boolean) => void
}

const KEY = 'deorbit.best'

function load(): { score: number; time: number | null } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { score?: unknown; time?: unknown } | null
    return {
      score: typeof v?.score === 'number' && v.score >= 0 ? v.score : 0,
      time: typeof v?.time === 'number' && v.time > 0 ? v.time : null,
    }
  } catch {
    return { score: 0, time: null } // storage can be blocked (private window)
  }
}

export const useBest = create<Best>((set, get) => ({
  ...load(),
  fresh: false,
  record: (score, seconds, won) => {
    const { score: bs, time: bt } = get()
    const better = score > bs || (won && (bt === null || seconds < bt))
    const next = { score: Math.max(bs, score), time: won && (bt === null || seconds < bt) ? seconds : bt }
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* not remembered: fine */
    }
    set({ ...next, fresh: better })
  },
}))

export const clock = (seconds: number): string => {
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
