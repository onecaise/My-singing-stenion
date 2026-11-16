import { useState } from 'react'
import { engine } from '../audio/engine'
import { exportMasterLoops } from '../audio/exporter'
import { useStage } from '../state/StageContext'
import { NOTE_NAMES, type MusicalMode } from '../types'
import { BeatIndicator } from './BeatIndicator'

export function TransportBar({ mixerOpen, onToggleMixer }: { mixerOpen: boolean; onToggleMixer: () => void }) {
  const { song, isPlaying, tempoMismatch, setBpm, setLoopBars, setMasterVolume, setSongKey, playAll, stopAll } = useStage()
  const [exportLoops, setExportLoops] = useState(4)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (song.placedMonsters.length === 0) return
    setExporting(true)
    try {
      await engine.resume()
      const blob = await exportMasterLoops(engine, exportLoops)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${song.name.replace(/\s+/g, '-').toLowerCase() || 'stewnion-song'}.webm`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 bg-[#2a1f45] px-4 py-2.5 text-white shadow-inner">
      <button
        type="button"
        onClick={() => (isPlaying ? stopAll() : playAll())}
        className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-black shadow ${
          isPlaying ? 'bg-rose-500 hover:bg-rose-400' : 'bg-emerald-400 text-[#1d4030] hover:bg-emerald-300'
        }`}
      >
        {isPlaying ? '⏹ Stop' : '▶️ Play'}
      </button>

      <BeatIndicator active={isPlaying} />

      <label className="flex items-center gap-2 text-xs font-bold">
        BPM
        <input
          type="number"
          min={40}
          max={220}
          value={song.bpm}
          onChange={(e) => setBpm(Number(e.target.value) || song.bpm)}
          className="w-16 rounded-lg bg-white/10 px-2 py-1 text-center text-sm outline-none focus:ring-2 focus:ring-amber-300"
        />
      </label>

      <label className="flex items-center gap-2 text-xs font-bold">
        Bars
        <select
          value={song.loopBars}
          onChange={(e) => setLoopBars(Number(e.target.value))}
          className="rounded-lg bg-white/10 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-amber-300"
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n} className="text-black">
              {n}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs font-bold">
        Key
        <select
          value={song.key.tonic}
          onChange={(e) => void setSongKey({ ...song.key, tonic: e.target.value })}
          className="rounded-lg bg-white/10 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-amber-300"
        >
          {NOTE_NAMES.map((n) => (
            <option key={n} value={n} className="text-black">
              {n}
            </option>
          ))}
        </select>
        <select
          value={song.key.mode}
          onChange={(e) => void setSongKey({ ...song.key, mode: e.target.value as MusicalMode })}
          className="rounded-lg bg-white/10 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-amber-300"
        >
          <option value="major" className="text-black">
            major
          </option>
          <option value="minor" className="text-black">
            minor
          </option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs font-bold">
        🔊
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          defaultValue={song.masterVolume}
          onChange={(e) => setMasterVolume(Number(e.target.value))}
          className="w-24"
        />
      </label>

      {tempoMismatch && (
        <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-200">
          ⚠️ Some monsters were recorded at a different tempo — pitch nudged to stay in sync
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMixer}
          className={`rounded-full px-4 py-2 text-sm font-black shadow ${
            mixerOpen ? 'bg-amber-300 text-[#3a2a5c]' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          🎚️ Mixer
        </button>
        <label className="flex items-center gap-1 text-xs font-bold">
          Export
          <input
            type="number"
            min={1}
            max={16}
            value={exportLoops}
            onChange={(e) => setExportLoops(Number(e.target.value) || 1)}
            className="w-12 rounded-lg bg-white/10 px-2 py-1 text-center text-sm outline-none focus:ring-2 focus:ring-amber-300"
          />
          loops
        </label>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || song.placedMonsters.length === 0}
          className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-black text-white shadow hover:bg-indigo-400 disabled:opacity-40"
        >
          {exporting ? 'Exporting…' : '⬇️ Export'}
        </button>
      </div>
    </div>
  )
}
