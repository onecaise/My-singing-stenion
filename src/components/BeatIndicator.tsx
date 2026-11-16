import { useBeatClock } from '../hooks/useBeatClock'
import { BEATS_PER_BAR } from '../types'

export function BeatIndicator({ active }: { active: boolean }) {
  const { beatInBar, isPlaying } = useBeatClock(active)
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: BEATS_PER_BAR }).map((_, i) => (
        <div
          key={i}
          className={`h-3 w-3 rounded-full transition-all duration-75 ${
            isPlaying && i === beatInBar ? 'scale-125 bg-amber-300 shadow-[0_0_8px_2px_rgba(252,211,77,0.8)]' : 'bg-white/25'
          }`}
        />
      ))}
    </div>
  )
}
