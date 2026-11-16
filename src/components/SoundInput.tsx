import { useCallback, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import { decodeBlobToBuffer, fitBufferToDuration, loopDurationSec } from '../audio/buffers'
import { MicPermissionError, recordMonsterLoop, type RecordProgress } from '../audio/recorder'
import { BEATS_PER_BAR } from '../types'

interface SoundInputProps {
  bpm: number
  loopBars: number
  value: Blob | null
  onChange: (blob: Blob) => void
}

export function SoundInput({ bpm, loopBars, value, onChange }: SoundInputProps) {
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState<RecordProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const stopPreview = useCallback(() => {
    previewSourceRef.current?.stop()
    previewSourceRef.current = null
    setPreviewing(false)
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    stopPreview()
    await engine.resume()
    setRecording(true)
    setProgress({ phase: 'countin', progress: 0, beat: 0 })
    try {
      const blob = await recordMonsterLoop({
        ctx: engine.ctx,
        bpm,
        loopBars,
        onProgress: setProgress,
      })
      onChange(blob)
    } catch (err) {
      if (err instanceof MicPermissionError) setError(err.message)
      else setError('Recording failed. Please try again.')
    } finally {
      setRecording(false)
      setProgress(null)
    }
  }, [bpm, loopBars, onChange, stopPreview])

  const handleFile = useCallback(
    (file: File) => {
      setError(null)
      onChange(file)
    },
    [onChange],
  )

  const togglePreview = useCallback(async () => {
    if (previewing) {
      stopPreview()
      return
    }
    if (!value) return
    await engine.resume()
    try {
      const raw = await decodeBlobToBuffer(engine.ctx, value)
      const fitted = fitBufferToDuration(engine.ctx, raw, loopDurationSec(bpm, loopBars))
      const source = engine.ctx.createBufferSource()
      source.buffer = fitted
      source.loop = true
      source.connect(engine.master)
      source.onended = () => setPreviewing(false)
      source.start()
      previewSourceRef.current = source
      setPreviewing(true)
    } catch {
      setError('Could not play that audio file.')
    }
  }, [bpm, loopBars, previewing, stopPreview, value])

  const totalBeats = BEATS_PER_BAR + loopBars * BEATS_PER_BAR
  const progressBeatIndex = progress ? (progress.phase === 'countin' ? progress.beat : BEATS_PER_BAR + progress.beat) : -1

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={recording}
          onClick={startRecording}
          className="flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow hover:bg-rose-400 disabled:opacity-50"
        >
          🎙️ {recording ? 'Recording…' : 'Record from mic'}
        </button>
        <button
          type="button"
          disabled={recording}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-bold text-white shadow hover:bg-indigo-400 disabled:opacity-50"
        >
          📁 Upload audio
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.webm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
        {value && (
          <button
            type="button"
            onClick={togglePreview}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow hover:bg-emerald-400"
          >
            {previewing ? '⏹ Stop' : '▶️ Preview'}
          </button>
        )}
      </div>

      {recording && progress && (
        <div className="rounded-xl bg-black/20 p-3">
          <div className="mb-1 flex justify-between text-xs font-semibold text-white/80">
            <span>{progress.phase === 'countin' ? 'Get ready…' : 'Recording!'}</span>
            <span>{progress.phase === 'countin' ? 'count-in' : `loop ${(progress.progress * 100).toFixed(0)}%`}</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: totalBeats }).map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  i < BEATS_PER_BAR ? 'opacity-60' : ''
                } ${i <= progressBeatIndex ? (progress.phase === 'recording' ? 'bg-rose-400' : 'bg-amber-300') : 'bg-white/20'}`}
              />
            ))}
          </div>
        </div>
      )}

      {value && !recording && (
        <p className="text-xs text-white/60">Sound ready — {(value.size / 1024).toFixed(0)} KB</p>
      )}
      {error && <p className="text-xs font-semibold text-rose-300">{error}</p>}
    </div>
  )
}
