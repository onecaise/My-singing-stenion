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

const ONSET_WINDOW_SEC = 0.01

interface EnergyEnvelope {
  energies: number[]
  hopSec: number
}

/** Short-time RMS energy envelope used by both onset-detection functions. */
function computeEnergyEnvelope(buffer: AudioBuffer): EnergyEnvelope {
  const mono = toMono(buffer)
  const sampleRate = buffer.sampleRate
  const hop = Math.max(1, Math.round(sampleRate * ONSET_WINDOW_SEC))
  const numWindows = Math.floor(mono.length / hop)
  const energies: number[] = new Array(numWindows)
  for (let w = 0; w < numWindows; w++) {
    let sum = 0
    const start = w * hop
    const end = Math.min(mono.length, start + hop)
    for (let i = start; i < end; i++) sum += mono[i] * mono[i]
    energies[w] = Math.sqrt(sum / hop)
  }
  return { energies, hopSec: hop / sampleRate }
}

/** Energy level that counts as "a real sound", derived from this buffer's
 * own noise floor/peak rather than a fixed number, so quiet and loud
 * recordings both work. */
function onsetThreshold(energies: number[]): number {
  if (energies.length === 0) return 0
  const sorted = [...energies].sort((a, b) => a - b)
  const noiseFloor = sorted[Math.floor(sorted.length * 0.1)] ?? 0
  const peak = sorted[sorted.length - 1] ?? 0
  return Math.max(noiseFloor * 3, peak * 0.08)
}

/** Finds where the first real sound starts in the buffer, in seconds, for
 * auto-aligning the loop onto beat 1. Returns 0 if nothing clears the
 * threshold (e.g. near-silent audio). */
export function detectOnsetSec(buffer: AudioBuffer): number {
  const { energies, hopSec } = computeEnergyEnvelope(buffer)
  const threshold = onsetThreshold(energies)
  for (let w = 0; w < energies.length; w++) {
    if (energies[w] > threshold) return Math.max(0, w * hopSec - hopSec)
  }
  return 0
}

/** Finds every transient in the buffer (energy rising sharply above the
 * threshold), at least `minSpacingSec` apart, for the optional Quantize
 * feature. */
export function detectOnsets(buffer: AudioBuffer, minSpacingSec = 0.12): number[] {
  const { energies, hopSec } = computeEnergyEnvelope(buffer)
  const threshold = onsetThreshold(energies)
  const minSpacingWindows = Math.max(1, Math.round(minSpacingSec / hopSec))
  const onsets: number[] = []
  let lastOnsetWindow = -Infinity
  for (let w = 1; w < energies.length; w++) {
    const rising = energies[w] > threshold && energies[w] > energies[w - 1] * 1.3
    if (rising && w - lastOnsetWindow >= minSpacingWindows) {
      onsets.push(w * hopSec)
      lastOnsetWindow = w
    }
  }
  return onsets
}

export interface AudioAnalysis {
  loudnessGainDb: number
  onsetSec: number
}

/** Runs the full "Make It Sound Good" analysis pipeline on a monster's raw
 * audio blob once, so every auto-mix feature can share a single decode. */
export async function analyzeMonsterAudio(ctx: BaseAudioContext, blob: Blob): Promise<AudioAnalysis> {
  const buffer = await decodeBlobToBuffer(ctx, blob)
  return {
    loudnessGainDb: computeLoudnessGainDb(buffer),
    onsetSec: detectOnsetSec(buffer),
  }
}
