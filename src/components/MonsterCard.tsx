import type { Monster } from '../types'
import { MonsterFace } from './MonsterFace'

export function MonsterCard({
  monster,
  isPreviewing,
  onPreview,
  onEdit,
}: {
  monster: Monster
  isPreviewing: boolean
  onPreview: () => void
  onEdit: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/10 p-4 text-center shadow-lg transition-transform hover:-translate-y-1">
      <MonsterFace monster={monster} size={72} />
      <p className="max-w-[9rem] truncate text-sm font-bold text-white">{monster.name}</p>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onPreview}
          className={`rounded-full px-3 py-1 text-xs font-bold text-white shadow ${
            isPreviewing ? 'bg-rose-500 hover:bg-rose-400' : 'bg-emerald-500 hover:bg-emerald-400'
          }`}
        >
          {isPreviewing ? '⏹ Stop' : '▶️ Play'}
        </button>
        <button type="button" onClick={onEdit} className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white hover:bg-white/25">
          ✏️ Edit
        </button>
      </div>
    </div>
  )
}
