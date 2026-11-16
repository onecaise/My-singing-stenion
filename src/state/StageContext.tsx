import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { engine } from '../audio/engine'
import { prepareVoiceBuffer } from '../audio/voicePrep'
import { deleteSong as deleteSongRecord, loadAllSongs, saveBlob, saveSong } from '../storage/db'
import { BUILT_IN_BACKDROPS, makeId, type Backdrop, type PlacedMonster, type Song } from '../types'
import { useMonsters } from './MonstersContext'

interface VoiceStartSignal {
  token: number
  delayMs: number
}

interface StageContextValue {
  song: Song
  songs: Song[]
  isPlaying: boolean
  tempoMismatch: boolean
  voiceStartSignals: Record<string, VoiceStartSignal>
  placeMonster: (monsterId: string, x: number, y: number) => Promise<void>
  moveMonster: (monsterId: string, x: number, y: number) => void
  removeMonster: (monsterId: string) => void
  toggleMute: (monsterId: string) => void
  toggleSolo: (monsterId: string) => void
  setBpm: (bpm: number) => Promise<void>
  setLoopBars: (bars: number) => Promise<void>
  setMasterVolume: (v: number) => void
  setBackdrop: (b: Backdrop) => void
  uploadBackdrop: (file: File) => Promise<void>
  playAll: () => Promise<void>
  stopAll: () => void
  renameSong: (name: string) => void
  saveCurrentSong: () => Promise<void>
  loadSong: (song: Song) => Promise<void>
  deleteSong: (id: string) => Promise<void>
  newSong: () => void
}

const StageContext = createContext<StageContextValue | null>(null)

function defaultSong(): Song {
  const now = Date.now()
  return {
    id: makeId(),
    name: 'Untitled Song',
    backdrop: BUILT_IN_BACKDROPS[0],
    placedMonsters: [],
    bpm: 100,
    loopBars: 2,
    masterVolume: 0.9,
    createdAt: now,
    updatedAt: now,
  }
}

export function StageProvider({ children }: { children: ReactNode }) {
  const { monsters, getRawBuffer } = useMonsters()
  const [song, setSong] = useState<Song>(defaultSong)
  const [songs, setSongs] = useState<Song[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [voiceStartSignals, setVoiceStartSignals] = useState<Record<string, VoiceStartSignal>>({})
  const tokenRef = useRef(0)
  const monstersRef = useRef(monsters)
  monstersRef.current = monsters

  useEffect(() => {
    loadAllSongs().then(setSongs)
  }, [])

  // if a monster gets deleted while placed on stage, drop it live
  useEffect(() => {
    setSong((prev) => {
      const stillValid = prev.placedMonsters.filter((p) => monsters.some((m) => m.id === p.monsterId))
      if (stillValid.length === prev.placedMonsters.length) return prev
      const removedIds = prev.placedMonsters.filter((p) => !stillValid.includes(p)).map((p) => p.monsterId)
      removedIds.forEach((id) => engine.removeVoice(id))
      return { ...prev, placedMonsters: stillValid }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monsters])

  const markStarted = useCallback((monsterId: string, delayMs: number) => {
    tokenRef.current += 1
    setVoiceStartSignals((prev) => ({ ...prev, [monsterId]: { token: tokenRef.current, delayMs } }))
  }, [])

  const startVoiceFor = useCallback(
    async (placed: PlacedMonster, bpm: number, loopBars: number) => {
      const monster = monstersRef.current.find((m) => m.id === placed.monsterId)
      if (!monster) return
      const raw = await getRawBuffer(monster)
      const prepared = prepareVoiceBuffer(engine.ctx, {
        rawBuffer: raw,
        offsetSec: monster.offsetSec,
        recordedBpm: monster.recordedBpm,
        recordedLoopBars: monster.recordedLoopBars,
        currentBpm: bpm,
        currentLoopBars: loopBars,
      })
      const { delayMs } = engine.addVoice(placed.monsterId, {
        buffer: prepared.buffer,
        playbackRate: prepared.playbackRate,
        volume: monster.volume,
        muted: placed.muted,
        soloed: placed.soloed,
      })
      markStarted(placed.monsterId, delayMs)
    },
    [getRawBuffer, markStarted],
  )

  const tempoMismatch = useMemo(
    () =>
      song.placedMonsters.some((p) => {
        const monster = monsters.find((m) => m.id === p.monsterId)
        return monster && (monster.recordedBpm !== song.bpm || monster.recordedLoopBars !== song.loopBars)
      }),
    [song.placedMonsters, song.bpm, song.loopBars, monsters],
  )

  const placeMonster = useCallback(
    async (monsterId: string, x: number, y: number) => {
      await engine.resume()
      setSong((prev) => {
        if (prev.placedMonsters.some((p) => p.monsterId === monsterId)) return prev
        return { ...prev, placedMonsters: [...prev.placedMonsters, { monsterId, x, y, muted: false, soloed: false }], updatedAt: Date.now() }
      })
      await startVoiceFor({ monsterId, x, y, muted: false, soloed: false }, song.bpm, song.loopBars)
      setIsPlaying(true)
    },
    [startVoiceFor, song.bpm, song.loopBars],
  )

  const moveMonster = useCallback((monsterId: string, x: number, y: number) => {
    setSong((prev) => ({
      ...prev,
      placedMonsters: prev.placedMonsters.map((p) => (p.monsterId === monsterId ? { ...p, x, y } : p)),
      updatedAt: Date.now(),
    }))
  }, [])

  const removeMonster = useCallback((monsterId: string) => {
    engine.removeVoice(monsterId)
    setSong((prev) => ({ ...prev, placedMonsters: prev.placedMonsters.filter((p) => p.monsterId !== monsterId), updatedAt: Date.now() }))
  }, [])

  const toggleMute = useCallback((monsterId: string) => {
    setSong((prev) => ({
      ...prev,
      placedMonsters: prev.placedMonsters.map((p) => {
        if (p.monsterId !== monsterId) return p
        const muted = !p.muted
        engine.setMuted(monsterId, muted)
        return { ...p, muted }
      }),
    }))
  }, [])

  const toggleSolo = useCallback((monsterId: string) => {
    setSong((prev) => ({
      ...prev,
      placedMonsters: prev.placedMonsters.map((p) => {
        const soloed = p.monsterId === monsterId ? !p.soloed : p.soloed
        engine.setSoloed(p.monsterId, soloed)
        return { ...p, soloed }
      }),
    }))
  }, [])

  const resyncAll = useCallback(
    async (bpm: number, loopBars: number) => {
      engine.stopAll()
      engine.setBpm(bpm)
      engine.setLoopBars(loopBars)
      const current = song.placedMonsters
      if (current.length === 0) {
        setIsPlaying(false)
        return
      }
      await Promise.all(current.map((p) => startVoiceFor(p, bpm, loopBars)))
      setIsPlaying(true)
    },
    [song.placedMonsters, startVoiceFor],
  )

  const setBpm = useCallback(
    async (bpm: number) => {
      setSong((prev) => ({ ...prev, bpm, updatedAt: Date.now() }))
      await resyncAll(bpm, song.loopBars)
    },
    [resyncAll, song.loopBars],
  )

  const setLoopBars = useCallback(
    async (bars: number) => {
      setSong((prev) => ({ ...prev, loopBars: bars, updatedAt: Date.now() }))
      await resyncAll(song.bpm, bars)
    },
    [resyncAll, song.bpm],
  )

  const setMasterVolume = useCallback((v: number) => {
    engine.setMasterVolume(v)
    setSong((prev) => ({ ...prev, masterVolume: v }))
  }, [])

  const setBackdrop = useCallback((b: Backdrop) => {
    setSong((prev) => ({ ...prev, backdrop: b, updatedAt: Date.now() }))
  }, [])

  const uploadBackdrop = useCallback(async (file: File) => {
    const blobKey = await saveBlob(file, 'backdrop-')
    setSong((prev) => ({ ...prev, backdrop: { kind: 'custom', id: makeId(), name: file.name, blobKey }, updatedAt: Date.now() }))
  }, [])

  const playAll = useCallback(async () => {
    await engine.resume()
    await resyncAll(song.bpm, song.loopBars)
  }, [resyncAll, song.bpm, song.loopBars])

  const stopAllFn = useCallback(() => {
    engine.stopAll()
    setIsPlaying(false)
  }, [])

  const renameSong = useCallback((name: string) => {
    setSong((prev) => ({ ...prev, name, updatedAt: Date.now() }))
  }, [])

  const saveCurrentSong = useCallback(async () => {
    const toSave = { ...song, updatedAt: Date.now() }
    await saveSong(toSave)
    setSong(toSave)
    setSongs((prev) => {
      const without = prev.filter((s) => s.id !== toSave.id)
      return [toSave, ...without]
    })
  }, [song])

  const loadSong = useCallback(
    async (target: Song) => {
      engine.stopAll()
      setSong(target)
      if (target.placedMonsters.length > 0) {
        engine.setBpm(target.bpm)
        engine.setLoopBars(target.loopBars)
        engine.setMasterVolume(target.masterVolume)
        await Promise.all(target.placedMonsters.map((p) => startVoiceFor(p, target.bpm, target.loopBars)))
        setIsPlaying(true)
      } else {
        setIsPlaying(false)
      }
    },
    [startVoiceFor],
  )

  const deleteSongFn = useCallback(async (id: string) => {
    await deleteSongRecord(id)
    setSongs((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const newSong = useCallback(() => {
    engine.stopAll()
    setIsPlaying(false)
    setSong(defaultSong())
  }, [])

  const value = useMemo<StageContextValue>(
    () => ({
      song,
      songs,
      isPlaying,
      tempoMismatch,
      voiceStartSignals,
      placeMonster,
      moveMonster,
      removeMonster,
      toggleMute,
      toggleSolo,
      setBpm,
      setLoopBars,
      setMasterVolume,
      setBackdrop,
      uploadBackdrop,
      playAll,
      stopAll: stopAllFn,
      renameSong,
      saveCurrentSong,
      loadSong,
      deleteSong: deleteSongFn,
      newSong,
    }),
    [
      song,
      songs,
      isPlaying,
      tempoMismatch,
      voiceStartSignals,
      placeMonster,
      moveMonster,
      removeMonster,
      toggleMute,
      toggleSolo,
      setBpm,
      setLoopBars,
      setMasterVolume,
      setBackdrop,
      uploadBackdrop,
      playAll,
      stopAllFn,
      renameSong,
      saveCurrentSong,
      loadSong,
      deleteSongFn,
      newSong,
    ],
  )

  return <StageContext.Provider value={value}>{children}</StageContext.Provider>
}

export function useStage(): StageContextValue {
  const ctx = useContext(StageContext)
  if (!ctx) throw new Error('useStage must be used within StageProvider')
  return ctx
}
