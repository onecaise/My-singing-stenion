export const BEATS_PER_BAR = 4

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
  /** seconds to rotate the loop start point by */
  offsetSec: number
  /** bpm the audio was captured/trimmed at, so we can warn/resync on global bpm changes */
  recordedBpm: number
  /** loop length (in bars) the audio was captured/trimmed at */
  recordedLoopBars: number
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

export interface Song {
  id: string
  name: string
  backdrop: Backdrop
  placedMonsters: PlacedMonster[]
  bpm: number
  loopBars: number
  masterVolume: number
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
