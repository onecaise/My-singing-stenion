import { ALL_ROLES, ROLE_LABELS, defaultPanForRole } from '../audio/roles'
import { useMonsters } from '../state/MonstersContext'
import { useStage } from '../state/StageContext'
import type { MonsterRole } from '../types'
import { MonsterFace } from './MonsterFace'

export function MixerDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { monsters } = useMonsters()
  const { song, toggleMute, toggleSolo, setMonsterLiveVolume, setMonsterPan, setMonsterLoudnessEnabled, setMonsterProcessingAndRebuild } = useStage()

  if (!open) return null

  return (
    <aside className="m-3 ml-0 flex w-64 shrink-0 flex-col gap-2 overflow-y-auto rounded-2xl bg-[#2a1f45] p-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="px-1 text-[11px] font-black uppercase tracking-wide text-white/50">Mixer</p>
        <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/70 hover:bg-white/20">
          Close
        </button>
      </div>

      {song.placedMonsters.length === 0 && <p className="px-1 text-xs text-white/50">Drag monsters onto the stage to mix them here.</p>}

      {song.placedMonsters.map((placed) => {
        const monster = monsters.find((m) => m.id === placed.monsterId)
        if (!monster) return null
        return (
          <div key={placed.monsterId} className="rounded-xl bg-white/5 p-2.5">
            <div className="mb-1.5 flex items-center gap-2">
              <MonsterFace monster={monster} size={28} />
              <p className="flex-1 truncate text-xs font-bold text-white">{monster.name}</p>
              <button
                type="button"
                onClick={() => toggleSolo(placed.monsterId)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  placed.soloed ? 'bg-amber-400 text-[#3a2a5c]' : 'bg-black/30 text-white/70 hover:bg-black/50'
                }`}
              >
                S
              </button>
              <button
                type="button"
                onClick={() => toggleMute(placed.monsterId)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  placed.muted ? 'bg-rose-500 text-white' : 'bg-black/30 text-white/70 hover:bg-black/50'
                }`}
              >
                M
              </button>
            </div>

            <label className="mb-1.5 flex items-center gap-2 text-[10px] font-bold text-white/60">
              Vol
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={monster.volume}
                onChange={(e) => setMonsterLiveVolume(placed.monsterId, Number(e.target.value))}
                className="w-full"
              />
            </label>

            <label className="mb-1.5 flex items-center gap-2 text-[10px] font-bold text-white/60">
              Pan
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={monster.processing.pan}
                onChange={(e) => setMonsterPan(placed.monsterId, Number(e.target.value))}
                className="w-full"
              />
            </label>

            <label className="mb-1.5 flex items-center gap-2 text-[10px] font-bold text-white/60">
              Role
              <select
                value={monster.processing.role}
                onChange={(e) => {
                  const role = e.target.value as MonsterRole
                  void setMonsterProcessingAndRebuild(placed.monsterId, { role, roleAuto: false, pan: defaultPanForRole(role, monster.id) })
                }}
                className="flex-1 rounded-lg bg-white/10 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-amber-300"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r} className="text-black">
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-white/60">
                <input
                  type="checkbox"
                  checked={monster.processing.roleEqEnabled}
                  onChange={(e) => void setMonsterProcessingAndRebuild(placed.monsterId, { roleEqEnabled: e.target.checked })}
                />
                Role EQ
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-white/60">
                <input
                  type="checkbox"
                  checked={monster.processing.loudnessEnabled}
                  onChange={(e) => setMonsterLoudnessEnabled(placed.monsterId, e.target.checked)}
                />
                Loudness match
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-white/60">
                <input
                  type="checkbox"
                  checked={monster.processing.autoAlignEnabled}
                  onChange={(e) => void setMonsterProcessingAndRebuild(placed.monsterId, { autoAlignEnabled: e.target.checked })}
                />
                Auto-align to beat 1
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-white/60">
                <input
                  type="checkbox"
                  checked={monster.processing.quantizeEnabled}
                  onChange={(e) => void setMonsterProcessingAndRebuild(placed.monsterId, { quantizeEnabled: e.target.checked })}
                />
                Quantize (can sound glitchy)
              </label>
            </div>
          </div>
        )
      })}
    </aside>
  )
}
