/**
 * Offline analysis used to auto-suggest "Make It Sound Good" settings.
 * Everything here reads an AudioBuffer and returns plain numbers/structs —
 * no playback, no side effects — so it's safe to run right after a
 * recording/upload finishes.
 */
import { decodeBlobToBuffer } from './buffers'

const MIN_DB = -60

/** Mixes all channels down to one Float32Array for analysis. */
function toMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0)
  const out = new Float32Array(buffer.length)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < out.length; i++) out[i] += data[i] / buffer.numberOfChannels
  }
  return out
}

function linearToDb(linear: number): number {
  if (linear <= 0) return MIN_DB
  return Math.max(MIN_DB, 20 * Math.log10(linear))
}

/** Root-mean-square loudness of the whole buffer, in dBFS. */
export function measureRmsDb(buffer: AudioBuffer): number {
  const mono = toMono(buffer)
  let sumSquares = 0
  for (let i = 0; i < mono.length; i++) sumSquares += mono[i] * mono[i]
  const rms = Math.sqrt(sumSquares / Math.max(1, mono.length))
  return linearToDb(rms)
}

/** Gain (in dB) to apply so this loop's RMS lands on `targetDb`, clamped so
 * near-silent or clipping recordings don't get pushed to absurd levels. */
export function computeLoudnessGainDb(buffer: AudioBuffer, targetDb = -18): number {
  const measured = measureRmsDb(buffer)
  const gainDb = targetDb - measured
  return Math.max(-18, Math.min(24, gainDb))
}

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

export interface AudioAnalysis {
  loudnessGainDb: number
}

/** Runs the full "Make It Sound Good" analysis pipeline on a monster's raw
 * audio blob once, so every auto-mix feature can share a single decode. */
export async function analyzeMonsterAudio(ctx: BaseAudioContext, blob: Blob): Promise<AudioAnalysis> {
  const buffer = await decodeBlobToBuffer(ctx, blob)
  return {
    loudnessGainDb: computeLoudnessGainDb(buffer),
  }
}
