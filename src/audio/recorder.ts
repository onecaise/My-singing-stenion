import { barDurationSec, loopDurationSec, renderClickBuffer } from './buffers'
import { BEATS_PER_BAR } from '../types'

export class MicPermissionError extends Error {
  constructor() {
    super('Microphone access was blocked. Allow mic access in your browser settings and try again.')
    this.name = 'MicPermissionError'
  }
}

export interface RecordProgress {
  phase: 'countin' | 'recording'
  progress: number
  beat: number
}

export interface RecordMonsterLoopParams {
  ctx: AudioContext
  bpm: number
  loopBars: number
  onProgress?: (p: RecordProgress) => void
  /** fires when recording actually starts (after the count-in bar) */
  onRecordingStart?: () => void
}

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  for (const type of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(type)) return type
  }
  return ''
}

/**
 * Records one loop's worth of microphone audio, preceded by a 1-bar
 * metronome count-in. The metronome keeps clicking through the take too, so
 * friends can stay locked to the beat the whole way through.
 */
export async function recordMonsterLoop(params: RecordMonsterLoopParams): Promise<Blob> {
  const { ctx, bpm, loopBars, onProgress, onRecordingStart } = params

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    throw new MicPermissionError()
  }

  const beatDur = barDurationSec(bpm) / BEATS_PER_BAR
  const countInBeats = BEATS_PER_BAR
  const recordingBeats = loopBars * BEATS_PER_BAR
  const totalLoopDuration = loopDurationSec(bpm, loopBars)

  const clickGain = ctx.createGain()
  clickGain.gain.value = 0.6
  clickGain.connect(ctx.destination)
  const accentBuf = renderClickBuffer(ctx, true)
  const tickBuf = renderClickBuffer(ctx, false)

  const scheduleStart = ctx.currentTime + 0.15
  const recordingStart = scheduleStart + countInBeats * beatDur
  const totalBeats = countInBeats + recordingBeats
  const clickSources: AudioBufferSourceNode[] = []
  for (let i = 0; i < totalBeats; i++) {
    const src = ctx.createBufferSource()
    src.buffer = i % BEATS_PER_BAR === 0 ? accentBuf : tickBuf
    src.connect(clickGain)
    src.start(scheduleStart + i * beatDur)
    clickSources.push(src)
  }

  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const stopTracks = () => stream.getTracks().forEach((t) => t.stop())

  let rafId: number
  const tickProgress = () => {
    const now = ctx.currentTime
    if (now < recordingStart) {
      const elapsed = now - scheduleStart
      onProgress?.({ phase: 'countin', progress: Math.min(1, elapsed / (countInBeats * beatDur)), beat: Math.floor(elapsed / beatDur) })
    } else {
      const elapsed = now - recordingStart
      onProgress?.({ phase: 'recording', progress: Math.min(1, elapsed / totalLoopDuration), beat: Math.floor(elapsed / beatDur) })
    }
    if (now < recordingStart + totalLoopDuration) {
      rafId = requestAnimationFrame(tickProgress)
    }
  }
  rafId = requestAnimationFrame(tickProgress)

  const result = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      cancelAnimationFrame(rafId)
      clickGain.disconnect()
      stopTracks()
      resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }))
    }
  })

  const startDelayMs = Math.max(0, (recordingStart - ctx.currentTime) * 1000)
  window.setTimeout(() => {
    recorder.start()
    onRecordingStart?.()
  }, startDelayMs)

  const stopDelayMs = Math.max(0, (recordingStart + totalLoopDuration - ctx.currentTime) * 1000)
  window.setTimeout(() => {
    if (recorder.state !== 'inactive') recorder.stop()
  }, stopDelayMs)

  return result
}
