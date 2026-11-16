import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { useRef, useState } from 'react'
import { BackdropView } from '../components/Backdrop'
import { MonsterFace } from '../components/MonsterFace'
import { SongManagerBar } from '../components/SongManagerBar'
import { StageMonster } from '../components/StageMonster'
import { TransportBar } from '../components/TransportBar'
import { TrayMonster } from '../components/TrayMonster'
import { useMonsters } from '../state/MonstersContext'
import { useStage } from '../state/StageContext'

type DragData = { type: 'tray' | 'placed'; monsterId: string }

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

export function SongPanel() {
  const { monsters } = useMonsters()
  const { song, isPlaying, voiceStartSignals, placeMonster, moveMonster, removeMonster, toggleMute, toggleSolo } = useStage()
  const stageBoxRef = useRef<HTMLDivElement | null>(null)
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null)

  const { setNodeRef: setStageDroppableRef, isOver } = useDroppable({ id: 'stage' })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDrag((event.active.data.current as DragData) ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null)
    const data = event.active.data.current as DragData | undefined
    const stageEl = stageBoxRef.current
    if (!data || !stageEl) return

    const rect = event.active.rect.current.translated ?? event.active.rect.current.initial
    if (!rect) return
    const stageRect = stageEl.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const x = ((centerX - stageRect.left) / stageRect.width) * 100
    const y = ((centerY - stageRect.top) / stageRect.height) * 100
    const insideStage = x >= 0 && x <= 100 && y >= 0 && y <= 100

    if (data.type === 'tray') {
      if (insideStage) void placeMonster(data.monsterId, clamp(x, 2, 98), clamp(y, 2, 98))
    } else {
      if (insideStage) moveMonster(data.monsterId, clamp(x, 2, 98), clamp(y, 2, 98))
      else removeMonster(data.monsterId)
    }
  }

  const activeMonster = activeDrag ? monsters.find((m) => m.id === activeDrag.monsterId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full flex-col">
        <SongManagerBar />
        <TransportBar />
        <div className="flex min-h-0 flex-1">
          <div
            ref={(node) => {
              stageBoxRef.current = node
              setStageDroppableRef(node)
            }}
            className={`relative m-3 flex-1 overflow-hidden rounded-3xl shadow-2xl ring-4 transition-all ${
              isOver ? 'ring-amber-300' : 'ring-transparent'
            }`}
          >
            <BackdropView backdrop={song.backdrop} />
            {song.placedMonsters.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="rounded-full bg-black/30 px-4 py-2 text-sm font-bold text-white/80">
                  Drag monsters here from the tray to start the beat →
                </p>
              </div>
            )}
            {song.placedMonsters.map((placed) => {
              const monster = monsters.find((m) => m.id === placed.monsterId)
              if (!monster) return null
              return (
                <StageMonster
                  key={placed.monsterId}
                  placed={placed}
                  monster={monster}
                  bpm={song.bpm}
                  isPlaying={isPlaying}
                  startSignal={voiceStartSignals[placed.monsterId]}
                  onToggleMute={() => toggleMute(placed.monsterId)}
                  onToggleSolo={() => toggleSolo(placed.monsterId)}
                  onRemove={() => removeMonster(placed.monsterId)}
                />
              )
            })}
          </div>

          <aside className="m-3 ml-0 flex w-40 shrink-0 flex-col gap-1 overflow-y-auto rounded-2xl bg-[#2a1f45] p-2 sm:w-48">
            <p className="mb-1 px-1 text-[11px] font-black uppercase tracking-wide text-white/50">Monster Tray</p>
            {monsters.length === 0 && <p className="px-1 text-xs text-white/50">Add monsters in the Monsters tab first.</p>}
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-2">
              {monsters.map((m) => (
                <TrayMonster key={m.id} monster={m} placed={song.placedMonsters.some((p) => p.monsterId === m.id)} />
              ))}
            </div>
          </aside>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeMonster ? (
          <div className="flex flex-col items-center opacity-90">
            <MonsterFace monster={activeMonster} size={64} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
