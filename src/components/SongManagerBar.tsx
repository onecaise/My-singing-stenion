import { useState } from 'react'
import { useStage } from '../state/StageContext'
import { BackdropPicker } from './BackdropPicker'

export function SongManagerBar() {
  const { song, songs, renameSong, saveCurrentSong, loadSong, deleteSong, newSong } = useStage()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2 bg-[#1f1735] px-4 py-2 text-white">
      <input
        value={song.name}
        onChange={(e) => renameSong(e.target.value)}
        className="w-40 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-300 sm:w-56"
        placeholder="Song name"
      />
      <button type="button" onClick={() => saveCurrentSong()} className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold hover:bg-emerald-400">
        💾 Save
      </button>
      <button type="button" onClick={newSong} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/25">
        ✨ New
      </button>
      <div className="relative">
        <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/25">
          📂 Load ({songs.length})
        </button>
        {open && (
          <div className="absolute left-0 top-10 z-40 max-h-72 w-64 overflow-y-auto rounded-2xl bg-[#3a2a5c] p-2 shadow-2xl">
            {songs.length === 0 && <p className="p-3 text-xs text-white/60">No saved songs yet.</p>}
            {songs.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 hover:bg-white/10">
                <button
                  type="button"
                  onClick={() => {
                    loadSong(s)
                    setOpen(false)
                  }}
                  className="flex-1 truncate text-left text-sm font-semibold"
                >
                  {s.name}
                </button>
                <button
                  type="button"
                  onClick={() => deleteSong(s.id)}
                  className="rounded-full bg-rose-600/70 px-2 py-0.5 text-[10px] font-bold hover:bg-rose-600"
                >
                  del
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="ml-auto">
        <BackdropPicker />
      </div>
    </div>
  )
}
