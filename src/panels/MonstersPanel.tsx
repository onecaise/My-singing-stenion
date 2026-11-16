import { useState } from 'react'
import { MonsterCard } from '../components/MonsterCard'
import { MonsterForm, type MonsterFormValues } from '../components/MonsterForm'
import { useMonsters } from '../state/MonstersContext'
import { useStage } from '../state/StageContext'
import type { Monster } from '../types'

export function MonstersPanel() {
  const { monsters, loading, createMonster, updateMonster, deleteMonster, previewingId, previewMonster, stopPreview } = useMonsters()
  const { song } = useStage()
  const [editing, setEditing] = useState<Monster | null>(null)
  const [creating, setCreating] = useState(false)

  const handleSave = async (values: MonsterFormValues) => {
    if (editing) {
      await updateMonster(editing.id, values)
    } else {
      await createMonster({
        name: values.name,
        color: values.color,
        emoji: values.emoji,
        imageBlob: values.imageBlob ?? null,
        audioBlob: values.audioBlob!,
        volume: values.volume,
        offsetSec: values.offsetSec,
      })
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#241a3b] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Your Monsters</h1>
          <p className="text-sm text-white/60">Give each friend a face and a beat. Drag them onto the stage from the Song tab.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-black text-[#3a2a5c] shadow-lg hover:bg-amber-300"
        >
          + Add Monster
        </button>
      </div>

      {loading ? (
        <p className="text-white/60">Loading monsters…</p>
      ) : monsters.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-white/50">
          <span className="text-5xl">👾</span>
          <p className="font-semibold">No monsters yet — add your first friend!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {monsters.map((m) => (
            <MonsterCard
              key={m.id}
              monster={m}
              isPreviewing={previewingId === m.id}
              onPreview={() => (previewingId === m.id ? stopPreview() : previewMonster(m))}
              onEdit={() => setEditing(m)}
            />
          ))}
        </div>
      )}

      {creating && (
        <MonsterForm
          monster={null}
          bpm={song.bpm}
          loopBars={song.loopBars}
          onSave={handleSave}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <MonsterForm
          monster={editing}
          bpm={song.bpm}
          loopBars={song.loopBars}
          onSave={handleSave}
          onDelete={async () => {
            await deleteMonster(editing.id)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
