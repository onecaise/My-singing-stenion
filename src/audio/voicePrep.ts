import { barDurationSec, fitBufferToDuration, loopDurationSec, rotateBuffer } from './buffers'
import { nearestSemitoneShiftToKey } from './key'
import { pitchShiftBuffer } from './pitchShift'
import { quantizeBuffer } from './quantize'
import type { DetectedPitch, MonsterRole, SongKey } from '../types'

export interface VoicePrepParams {
  rawBuffer: AudioBuffer
  /** manual fine-tune offset from the monster's offset slider */
  offsetSec: number
  recordedBpm: number
  recordedLoopBars: number
  currentBpm: number
  currentLoopBars: number
  /** seconds into the raw recording where the first real sound starts */
  detectedOnsetSec: number
  /** when false, the manual offset is used alone (no auto-align) */
  autoAlignEnabled: boolean
  /** nudges detected transients onto the nearest 16th note; off by default
   * because the simple slice-resample it uses can sound glitchy */
  quantizeEnabled: boolean
  role: MonsterRole
  detectedPitch: DetectedPitch | null
  snapToKeyEnabled: boolean
  songKey: SongKey
}

export interface PreparedVoice {
  buffer: AudioBuffer
  playbackRate: number
  /** true when the monster was captured at a different tempo/length than
   * the current global settings, so the caller can surface a warning */
  isTempoMismatched: boolean
}

/**
 * Fits a monster's raw decoded audio to its own recorded loop length, rotates
 * it so the detected onset lands on beat 1 (plus the manual fine-tune
 * offset), optionally quantizes transients onto the 16th-note grid, and
 * computes the playbackRate needed to make it fit the CURRENT global bar
 * grid (slightly pitch-shifting instead of re-encoding when the global
 * bpm/loop length has since changed).
 */
export function prepareVoiceBuffer(ctx: BaseAudioContext, params: VoicePrepParams): PreparedVoice {
  const recordedDuration = loopDurationSec(params.recordedBpm, params.recordedLoopBars)
  const fitted = fitBufferToDuration(ctx, params.rawBuffer, recordedDuration)

  const canSnapToKey = params.snapToKeyEnabled && params.detectedPitch && (params.role === 'melody' || params.role === 'chords')
  const semitoneShift = canSnapToKey ? nearestSemitoneShiftToKey(params.detectedPitch!, params.songKey) : 0
  const inKey = semitoneShift !== 0 ? pitchShiftBuffer(ctx, fitted, semitoneShift) : fitted

  const alignOffset = params.autoAlignEnabled ? params.detectedOnsetSec : 0
  const rotated = rotateBuffer(ctx, inKey, alignOffset + params.offsetSec)
  const gridStepSec = barDurationSec(params.recordedBpm) / 16
  const quantized = params.quantizeEnabled ? quantizeBuffer(ctx, rotated, gridStepSec) : rotated
  const currentDuration = loopDurationSec(params.currentBpm, params.currentLoopBars)
  const playbackRate = recordedDuration / currentDuration
  const isTempoMismatched =
    params.recordedBpm !== params.currentBpm || params.recordedLoopBars !== params.currentLoopBars
  return { buffer: quantized, playbackRate, isTempoMismatched }
}
