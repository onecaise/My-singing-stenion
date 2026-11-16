import { fitBufferToDuration, loopDurationSec, rotateBuffer } from './buffers'

export interface VoicePrepParams {
  rawBuffer: AudioBuffer
  offsetSec: number
  recordedBpm: number
  recordedLoopBars: number
  currentBpm: number
  currentLoopBars: number
}

export interface PreparedVoice {
  buffer: AudioBuffer
  playbackRate: number
  /** true when the monster was captured at a different tempo/length than
   * the current global settings, so the caller can surface a warning */
  isTempoMismatched: boolean
}

/**
 * Fits a monster's raw decoded audio to its own recorded loop length, then
 * rotates it by the trim offset, and computes the playbackRate needed to
 * make it fit the CURRENT global bar grid (slightly pitch-shifting instead
 * of re-encoding when the global bpm/loop length has since changed).
 */
export function prepareVoiceBuffer(ctx: BaseAudioContext, params: VoicePrepParams): PreparedVoice {
  const recordedDuration = loopDurationSec(params.recordedBpm, params.recordedLoopBars)
  const fitted = fitBufferToDuration(ctx, params.rawBuffer, recordedDuration)
  const rotated = rotateBuffer(ctx, fitted, params.offsetSec)
  const currentDuration = loopDurationSec(params.currentBpm, params.currentLoopBars)
  const playbackRate = recordedDuration / currentDuration
  const isTempoMismatched =
    params.recordedBpm !== params.currentBpm || params.recordedLoopBars !== params.currentLoopBars
  return { buffer: rotated, playbackRate, isTempoMismatched }
}
