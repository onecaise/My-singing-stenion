import { useDraggable } from '@dnd-kit/core'
import type { Monster } from '../types'
import { MonsterFace } from './MonsterFace'

export function TrayMonster({ monster, placed }: { monster: Monster; placed: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tray-${monster.id}`,
    data: { type: 'tray', monsterId: monster.id },
    disabled: placed,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex touch-none flex-col items-center gap-1 rounded-xl p-2 text-center transition-opacity ${
        placed ? 'cursor-default opacity-30' : isDragging ? 'cursor-grabbing opacity-40' : 'cursor-grab opacity-100 hover:bg-white/10'
      }`}
      title={placed ? `${monster.name} is already on stage` : `Drag ${monster.name} onto the stage`}
    >
      <MonsterFace monster={monster} size={52} />
      <span className="max-w-[4.5rem] truncate text-[11px] font-bold text-white">{monster.name}</span>
    </div>
  )
}
