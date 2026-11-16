export const BEATS_PER_BAR = 4

/** Which part a monster plays in the mix, driving its EQ preset and default pan. */
export type MonsterRole = 'bass' | 'beat' | 'chords' | 'melody' | 'fx'

export interface DetectedPitch {
  /** MIDI note number of the loop's estimated fundamental */
  midi: number
  /** e.g. "A3" */
  noteName: string
  /** 0..1 confidence from the pitch detector */
  clarity: number
}

/**
 * "Make It Sound Good" settings for one monster. Computed automatically from
 * the audio (so nothing about the original recording blob ever changes) and
 * individually toggle-able so the effect of each step can be A/B'd.
 */
export interface MonsterProcessing {
  role: MonsterRole
  /** false once the user has manually overridden the auto-suggested role */
  roleAuto: boolean
  /** -1 (left) .. 1 (right) */
  pan: number
  /** seconds into the raw recording where the first real sound starts */
  detectedOnsetSec: number
  /** gain (dB) to apply so this loop matches the target loudness */
  loudnessGainDb: number
  /** estimated main pitch of the loop, or null if no clear pitch was found */
  detectedPitch: DetectedPitch | null
  autoAlignEnabled: boolean
  quantizeEnabled: boolean
  loudnessEnabled: boolean
  roleEqEnabled: boolean
  snapToKeyEnabled: boolean
}

export function defaultProcessing(): MonsterProcessing {
  return {
    role: 'melody',
    roleAuto: true,
    pan: 0,
    detectedOnsetSec: 0,
    loudnessGainDb: 0,
    detectedPitch: null,
    autoAlignEnabled: true,
    quantizeEnabled: false,
    loudnessEnabled: true,
    roleEqEnabled: true,
    snapToKeyEnabled: true,
  }
}

export interface Monster {
  id: string
  name: string
  color: string
  emoji: string
  /** idb-keyval key for the uploaded/recorded photo blob, if any */
  imageBlobKey: string | null
  /** idb-keyval key for the raw audio blob (webm/wav/mp3/m4a) */
  audioBlobKey: string
  /** 0..1 */
  volume: number
  /** seconds to rotate the loop start point by (manual fine-tune, on top of auto-align) */
  offsetSec: number
  /** bpm the audio was captured/trimmed at, so we can warn/resync on global bpm changes */
  recordedBpm: number
  /** loop length (in bars) the audio was captured/trimmed at */
  recordedLoopBars: number
  /** "Make It Sound Good" analysis + toggles for this monster's loop */
  processing: MonsterProcessing
  createdAt: number
  updatedAt: number
}

export interface PlacedMonster {
  monsterId: string
  /** percentage (0-100) position on the stage */
  x: number
  y: number
  muted: boolean
  soloed: boolean
}

export interface BuiltInBackdrop {
  kind: 'builtin'
  id: string
  name: string
}

export interface CustomBackdrop {
  kind: 'custom'
  id: string
  name: string
  blobKey: string
}

export type Backdrop = BuiltInBackdrop | CustomBackdrop

export type MusicalMode = 'major' | 'minor'

export interface SongKey {
  /** pitch class name, e.g. "C", "F#" */
  tonic: string
  mode: MusicalMode
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export function defaultSongKey(): SongKey {
  return { tonic: 'C', mode: 'major' }
}

export interface Song {
  id: string
  name: string
  backdrop: Backdrop
  placedMonsters: PlacedMonster[]
  bpm: number
  loopBars: number
  masterVolume: number
  key: SongKey
  createdAt: number
  updatedAt: number
}

export const BUILT_IN_BACKDROPS: BuiltInBackdrop[] = [
  { kind: 'builtin', id: 'meadow', name: 'Giggling Meadow' },
  { kind: 'builtin', id: 'reef', name: 'Bubblepop Reef' },
  { kind: 'builtin', id: 'dusk', name: 'Marshmallow Dusk' },
  { kind: 'builtin', id: 'cave', name: 'Glimmer Cave' },
  { kind: 'builtin', id: 'nebula', name: 'Jelly Nebula' },
]

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}
