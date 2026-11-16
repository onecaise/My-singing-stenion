import { useDraggable } from '@dnd-kit/core'
import { useEffect, useRef } from 'react'
import { barDurationSec } from '../audio/buffers'
import { BEATS_PER_BAR, type Monster, type PlacedMonster } from '../types'
import { MonsterFace } from './MonsterFace'

interface StageMonsterProps {
  placed: PlacedMonster
  monster: Monster
  bpm: number
  isPlaying: boolean
  startSignal?: { token: number; delayMs: number }
  onToggleMute: () => void
  onToggleSolo: () => void
  onRemove: () => void
}

export function StageMonster({ placed, monster, bpm, isPlaying, startSignal, onToggleMute, onToggleSolo, onRemove }: StageMonsterProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `placed-${monster.id}`,
    data: { type: 'placed', monsterId: monster.id },
  })
  const bounceRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | null>(null)

  const beatDur = barDurationSec(bpm) / BEATS_PER_BAR

  useEffect(() => {
    const el = bounceRef.current
    if (!el) return
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    if (!isPlaying) {
      el.style.animation = 'none'
      return
    }
    const delay = startSignal?.delayMs ?? 0
    timeoutRef.current = window.setTimeout(() => {
      if (!bounceRef.current) return
      bounceRef.current.style.animation = `stewnion-bounce ${beatDur * 2}s ease-in-out infinite`
    }, delay)
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSignal?.token, isPlaying, beatDur])

  const effectivelyMuted = placed.muted
  const dimmed = effectivelyMuted

  return (
    <div
      ref={setNodeRef}
      className={`absolute flex -translate-x-1/2 -translate-y-1/2 touch-none flex-col items-center ${isDragging ? 'opacity-40' : ''}`}
      style={{
        left: `${placed.x}%`,
        top: `${placed.y}%`,
        zIndex: isDragging ? 30 : 10,
      }}
    >
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-1 -top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white shadow hover:bg-rose-500"
        aria-label={`Remove ${monster.name}`}
      >
        ×
      </button>
      {placed.soloed && (
        <span className="absolute -left-1 -top-1 z-20 rounded-full bg-amber-400 px-1 text-[9px] font-black text-[#3a2a5c] shadow">S</span>
      )}
      <div ref={bounceRef} className={`transition-opacity ${dimmed ? 'opacity-40' : 'opacity-100'}`}>
        <div {...listeners} {...attributes} onClick={onToggleMute} className="cursor-grab active:cursor-grabbing" title="Click to mute/unmute, drag to move">
          <MonsterFace monster={monster} size={64} />
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleSolo}
        className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow ${
          placed.soloed ? 'bg-amber-400 text-[#3a2a5c]' : 'bg-black/30 text-white/80 hover:bg-black/50'
        }`}
      >
        solo
      </button>
      <span className="mt-0.5 max-w-[4.5rem] truncate text-center text-[11px] font-bold text-white drop-shadow">{monster.name}</span>
    </div>
  )
}
