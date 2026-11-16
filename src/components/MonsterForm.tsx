import { useEffect, useMemo, useState } from 'react'
import { loopDurationSec } from '../audio/buffers'
import { loadBlob } from '../storage/db'
import type { Monster } from '../types'
import { PictureInput } from './PictureInput'
import { SoundInput } from './SoundInput'

export interface MonsterFormValues {
  name: string
  color: string
  emoji: string
  imageBlob: Blob | null | undefined // undefined = unchanged, null = removed, Blob = new
  audioBlob: Blob | undefined // undefined = unchanged
  volume: number
  offsetSec: number
}

interface MonsterFormProps {
  monster: Monster | null
  bpm: number
  loopBars: number
  onSave: (values: MonsterFormValues) => Promise<void>
  onDelete?: () => void
  onClose: () => void
}

export function MonsterForm({ monster, bpm, loopBars, onSave, onDelete, onClose }: MonsterFormProps) {
  const [name, setName] = useState(monster?.name ?? '')
  const [color, setColor] = useState(monster?.color ?? '#ffb347')
  const [emoji, setEmoji] = useState(monster?.emoji ?? '👾')
  const [imageBlob, setImageBlob] = useState<Blob | null>(null)
  const [imageChanged, setImageChanged] = useState(false)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioChanged, setAudioChanged] = useState(false)
  const [volume, setVolume] = useState(monster?.volume ?? 0.85)
  const [offsetSec, setOffsetSec] = useState(monster?.offsetSec ?? 0)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!monster) return
    let url: string | null = null
    let cancelled = false
    if (monster.imageBlobKey) {
      loadBlob(monster.imageBlobKey).then((blob) => {
        if (cancelled || !blob) return
        url = URL.createObjectURL(blob)
        setImagePreviewUrl(url)
      })
    }
    loadBlob(monster.audioBlobKey).then((blob) => {
      if (!cancelled && blob) setAudioBlob(blob)
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [monster])

  const effectiveBpm = monster && !audioChanged ? monster.recordedBpm : bpm
  const effectiveLoopBars = monster && !audioChanged ? monster.recordedLoopBars : loopBars
  const maxOffset = useMemo(() => loopDurationSec(effectiveBpm, effectiveLoopBars), [effectiveBpm, effectiveLoopBars])

  const handleImageChange = (file: File | null) => {
    setImageChanged(true)
    if (!file) {
      setImageBlob(null)
      setImagePreviewUrl(null)
      return
    }
    setImageBlob(file)
    setImagePreviewUrl(URL.createObjectURL(file))
  }

  const handleAudioChange = (blob: Blob) => {
    setAudioChanged(true)
    setAudioBlob(blob)
    setOffsetSec(0)
  }

  const canSave = name.trim().length > 0 && !!audioBlob && !saving

  const handleSubmit = async () => {
    if (!canSave || !audioBlob) return
    setSaving(true)
    setFormError(null)
    try {
      await onSave({
        name: name.trim(),
        color,
        emoji,
        imageBlob: imageChanged ? imageBlob : undefined,
        audioBlob: audioChanged ? audioBlob : undefined,
        volume,
        offsetSec,
      })
      onClose()
    } catch {
      setFormError('Something went wrong saving this monster. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#3a2a5c] p-6 text-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-xl font-black">{monster ? 'Edit Monster' : 'New Monster'}</h2>

        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/60">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cousin Dave"
          className="mb-4 w-full rounded-xl bg-white/10 px-3 py-2 text-sm outline-none ring-amber-300 placeholder:text-white/40 focus:ring-2"
        />

        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/60">Picture</label>
        <div className="mb-4">
          <PictureInput
            color={color}
            emoji={emoji}
            hasImage={imageChanged ? imageBlob !== null : !!monster?.imageBlobKey}
            imagePreviewUrl={imagePreviewUrl}
            onColorChange={setColor}
            onEmojiChange={setEmoji}
            onImageChange={handleImageChange}
          />
        </div>

        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/60">
          Sound (loop: {effectiveLoopBars} bar{effectiveLoopBars > 1 ? 's' : ''} @ {effectiveBpm} BPM)
        </label>
        <div className="mb-4">
          <SoundInput bpm={effectiveBpm} loopBars={effectiveLoopBars} value={audioBlob} onChange={handleAudioChange} />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 flex justify-between text-xs font-bold uppercase tracking-wide text-white/60">
              <span>Volume</span>
              <span>{Math.round(volume * 100)}%</span>
            </label>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label className="mb-1 flex justify-between text-xs font-bold uppercase tracking-wide text-white/60">
              <span>Start offset</span>
              <span>{offsetSec.toFixed(2)}s</span>
            </label>
            <input
              type="range"
              min={0}
              max={maxOffset}
              step={0.01}
              value={Math.min(offsetSec, maxOffset)}
              onChange={(e) => setOffsetSec(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {formError && <p className="mb-3 text-sm font-semibold text-rose-300">{formError}</p>}

        <div className="flex items-center justify-between gap-2">
          <div>
            {monster && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-full bg-rose-600/80 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSubmit}
              className="rounded-full bg-amber-400 px-5 py-2 text-sm font-black text-[#3a2a5c] shadow hover:bg-amber-300 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save Monster'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
