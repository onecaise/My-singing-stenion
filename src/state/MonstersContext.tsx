import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { engine } from '../audio/engine'
import { analyzeMonsterAudio, type AudioAnalysis } from '../audio/analysis'
import { decodeBlobToBuffer, fitBufferToDuration, rotateBuffer } from '../audio/buffers'
import { defaultPanForRole, suggestRole } from '../audio/roles'
import { deleteBlob, deleteMonster as deleteMonsterRecord, loadAllMonsters, loadBlob, saveBlob, saveMonster } from '../storage/db'
import { defaultProcessing, makeId, type Monster, type MonsterProcessing, type MonsterRole } from '../types'

/** Folds a fresh analysis pass into a processing record, re-suggesting the
 * role/pan unless the user already picked one manually. Shared by
 * createMonster, the "audio changed" branch of updateMonster, and
 * re-analyzing monsters that predate this feature. */
function applyAnalysis(
  base: MonsterProcessing,
  analysis: AudioAnalysis,
  monsterId: string,
  keepRole?: { role: MonsterRole; pan: number },
): MonsterProcessing {
  const next: MonsterProcessing = {
    ...base,
    loudnessGainDb: analysis.loudnessGainDb,
    detectedOnsetSec: analysis.onsetSec,
    detectedPitch: analysis.detectedPitch,
    analyzed: true,
  }
  if (keepRole) return { ...next, role: keepRole.role, roleAuto: false, pan: keepRole.pan }
  const role = suggestRole(analysis.spectralCentroidHz, analysis.onsetDensityPerSec)
  return { ...next, role, roleAuto: true, pan: defaultPanForRole(role, monsterId) }
}

export interface NewMonsterInput {
  name: string
  color: string
  emoji: string
  imageBlob: Blob | null
  audioBlob: Blob
  volume: number
  offsetSec: number
}

export type MonsterPatch = Partial<Pick<Monster, 'name' | 'color' | 'emoji' | 'volume' | 'offsetSec'>> & {
  imageBlob?: Blob | null
  audioBlob?: Blob
  processing?: Partial<MonsterProcessing>
}

interface MonstersContextValue {
  monsters: Monster[]
  loading: boolean
  createMonster: (input: NewMonsterInput) => Promise<Monster>
  updateMonster: (id: string, patch: MonsterPatch) => Promise<void>
  reanalyzeMonster: (id: string) => Promise<void>
  deleteMonster: (id: string) => Promise<void>
  getRawBuffer: (monster: Monster) => Promise<AudioBuffer>
  previewingId: string | null
  previewMonster: (monster: Monster) => Promise<void>
  stopPreview: () => void
}

const MonstersContext = createContext<MonstersContextValue | null>(null)

export function MonstersProvider({ children }: { children: ReactNode }) {
  const [monsters, setMonsters] = useState<Monster[]>([])
  const [loading, setLoading] = useState(true)
  const bufferCache = useRef(new Map<string, Promise<AudioBuffer>>())
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null)

  useEffect(() => {
    loadAllMonsters()
      .then(setMonsters)
      .finally(() => setLoading(false))
  }, [])

  const getRawBuffer = useCallback((monster: Monster): Promise<AudioBuffer> => {
    const cached = bufferCache.current.get(monster.audioBlobKey)
    if (cached) return cached
    const promise = loadBlob(monster.audioBlobKey).then((blob) => {
      if (!blob) throw new Error('Missing audio for monster')
      return decodeBlobToBuffer(engine.ctx, blob)
    })
    bufferCache.current.set(monster.audioBlobKey, promise)
    return promise
  }, [])

  const createMonster = useCallback(async (input: NewMonsterInput): Promise<Monster> => {
    const audioBlobKey = await saveBlob(input.audioBlob, 'audio-')
    const imageBlobKey = input.imageBlob ? await saveBlob(input.imageBlob, 'image-') : null
    const id = makeId()
    const analysis = await analyzeMonsterAudio(engine.ctx, input.audioBlob)
    const now = Date.now()
    const monster: Monster = {
      id,
      name: input.name,
      color: input.color,
      emoji: input.emoji,
      imageBlobKey,
      audioBlobKey,
      volume: input.volume,
      offsetSec: input.offsetSec,
      recordedBpm: engine.bpm,
      recordedLoopBars: engine.loopBars,
      processing: applyAnalysis(defaultProcessing(), analysis, id),
      createdAt: now,
      updatedAt: now,
    }
    await saveMonster(monster)
    setMonsters((prev) => [...prev, monster])
    return monster
  }, [])

  const updateMonster = useCallback(
    async (id: string, patch: MonsterPatch) => {
      const existing = monsters.find((m) => m.id === id)
      if (!existing) return
      let audioBlobKey = existing.audioBlobKey
      let recordedBpm = existing.recordedBpm
      let recordedLoopBars = existing.recordedLoopBars
      let processing = existing.processing
      if (patch.audioBlob) {
        await deleteBlob(existing.audioBlobKey)
        audioBlobKey = await saveBlob(patch.audioBlob, 'audio-')
        bufferCache.current.delete(existing.audioBlobKey)
        recordedBpm = engine.bpm
        recordedLoopBars = engine.loopBars
        const analysis = await analyzeMonsterAudio(engine.ctx, patch.audioBlob)
        const keepRole = existing.processing.roleAuto ? undefined : { role: existing.processing.role, pan: existing.processing.pan }
        processing = applyAnalysis(defaultProcessing(), analysis, id, keepRole)
      }
      if (patch.processing) {
        processing = { ...processing, ...patch.processing }
      }
      let imageBlobKey = existing.imageBlobKey
      if (patch.imageBlob !== undefined) {
        if (existing.imageBlobKey) await deleteBlob(existing.imageBlobKey)
        imageBlobKey = patch.imageBlob ? await saveBlob(patch.imageBlob, 'image-') : null
      }
      const updated: Monster = {
        ...existing,
        name: patch.name ?? existing.name,
        color: patch.color ?? existing.color,
        emoji: patch.emoji ?? existing.emoji,
        volume: patch.volume ?? existing.volume,
        offsetSec: patch.offsetSec ?? existing.offsetSec,
        audioBlobKey,
        imageBlobKey,
        recordedBpm,
        recordedLoopBars,
        processing,
        updatedAt: Date.now(),
      }
      await saveMonster(updated)
      setMonsters((prev) => prev.map((m) => (m.id === id ? updated : m)))
    },
    [monsters],
  )

  /** Runs the analysis pass on a monster that predates "Make It Sound
   * Good" (or whose audio was saved before analysis existed), without
   * touching the audio blob or any toggles the user has already set. */
  const reanalyzeMonster = useCallback(
    async (id: string) => {
      const existing = monsters.find((m) => m.id === id)
      if (!existing || existing.processing.analyzed) return
      const blob = await loadBlob(existing.audioBlobKey)
      if (!blob) return
      const analysis = await analyzeMonsterAudio(engine.ctx, blob)
      const keepRole = existing.processing.roleAuto ? undefined : { role: existing.processing.role, pan: existing.processing.pan }
      const processing = applyAnalysis(existing.processing, analysis, id, keepRole)
      const updated: Monster = { ...existing, processing, updatedAt: Date.now() }
      await saveMonster(updated)
      setMonsters((prev) => prev.map((m) => (m.id === id ? updated : m)))
    },
    [monsters],
  )

  const deleteMonster = useCallback(
    async (id: string) => {
      const existing = monsters.find((m) => m.id === id)
      if (!existing) return
      await deleteMonsterRecord(id)
      await deleteBlob(existing.audioBlobKey)
      await deleteBlob(existing.imageBlobKey)
      bufferCache.current.delete(existing.audioBlobKey)
      setMonsters((prev) => prev.filter((m) => m.id !== id))
    },
    [monsters],
  )

  const stopPreview = useCallback(() => {
    previewSourceRef.current?.stop()
    previewSourceRef.current = null
    setPreviewingId(null)
  }, [])

  const previewMonster = useCallback(
    async (monster: Monster) => {
      await engine.resume()
      stopPreview()
      const raw = await getRawBuffer(monster)
      const recordedDuration = (60 / monster.recordedBpm) * 4 * monster.recordedLoopBars
      const fitted = fitBufferToDuration(engine.ctx, raw, recordedDuration)
      const rotated = rotateBuffer(engine.ctx, fitted, monster.offsetSec)
      const source = engine.ctx.createBufferSource()
      source.buffer = rotated
      source.loop = true
      const gain = engine.ctx.createGain()
      gain.gain.value = monster.volume
      source.connect(gain).connect(engine.master)
      source.start()
      previewSourceRef.current = source
      setPreviewingId(monster.id)
    },
    [getRawBuffer, stopPreview],
  )

  const value = useMemo<MonstersContextValue>(
    () => ({
      monsters,
      loading,
      createMonster,
      updateMonster,
      reanalyzeMonster,
      deleteMonster,
      getRawBuffer,
      previewingId,
      previewMonster,
      stopPreview,
    }),
    [monsters, loading, createMonster, updateMonster, reanalyzeMonster, deleteMonster, getRawBuffer, previewingId, previewMonster, stopPreview],
  )

  return <MonstersContext.Provider value={value}>{children}</MonstersContext.Provider>
}

export function useMonsters(): MonstersContextValue {
  const ctx = useContext(MonstersContext)
  if (!ctx) throw new Error('useMonsters must be used within MonstersProvider')
  return ctx
}
