import { NOTE_NAMES, type DetectedPitch, type SongKey } from '../types'

const SCALE_INTERVALS: Record<SongKey['mode'], number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
}

function noteNameToPitchClass(name: string): number {
  const idx = NOTE_NAMES.indexOf(name as (typeof NOTE_NAMES)[number])
  return idx === -1 ? 0 : idx
}

function scalePitchClasses(key: SongKey): Set<number> {
  const tonicPc = noteNameToPitchClass(key.tonic)
  return new Set(SCALE_INTERVALS[key.mode].map((interval) => (tonicPc + interval) % 12))
}

/** Whether a detected pitch's pitch class belongs to the song's key/mode. */
export function pitchFitsKey(pitch: DetectedPitch, key: SongKey): boolean {
  const scale = scalePitchClasses(key)
  const pc = ((pitch.midi % 12) + 12) % 12
  return scale.has(pc)
}

/** Smallest-magnitude semitone shift that puts `pitch` into the song's key.
 * Returns 0 if it's already in key. */
export function nearestSemitoneShiftToKey(pitch: DetectedPitch, key: SongKey): number {
  const scale = scalePitchClasses(key)
  const pc = ((pitch.midi % 12) + 12) % 12
  if (scale.has(pc)) return 0
  let best = 0
  let bestAbs = Infinity
  for (let shift = -6; shift <= 6; shift++) {
    const shiftedPc = ((pc + shift) % 12 + 12) % 12
    if (scale.has(shiftedPc) && Math.abs(shift) < bestAbs) {
      best = shift
      bestAbs = Math.abs(shift)
    }
  }
  return best
}
