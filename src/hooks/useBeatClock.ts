import { useEffect, useState } from 'react'
import { engine } from '../audio/engine'
import { BEATS_PER_BAR } from '../types'

export interface BeatClockState {
  beatInBar: number
  isPlaying: boolean
}

/** Re-renders only when the current beat-in-bar actually changes, driven by
 * the engine's sample-accurate transport clock (not a setInterval). */
export function useBeatClock(active: boolean): BeatClockState {
  const [state, setState] = useState<BeatClockState>({ beatInBar: 0, isPlaying: false })

  useEffect(() => {
    if (!active) {
      setState({ beatInBar: 0, isPlaying: false })
      return
    }
    let rafId: number
    let lastBeat = -1
    const tick = () => {
      const info = engine.getBeatInfo()
      if (!info) {
        if (lastBeat !== -1) {
          lastBeat = -1
          setState({ beatInBar: 0, isPlaying: false })
        }
      } else if (info.beat !== lastBeat) {
        lastBeat = info.beat
        setState({ beatInBar: info.beat, isPlaying: true })
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [active])

  return state
}

export { BEATS_PER_BAR }
