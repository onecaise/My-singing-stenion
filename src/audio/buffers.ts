import { BEATS_PER_BAR } from '../types'

export function barDurationSec(bpm: number): number {
  return (60 / bpm) * BEATS_PER_BAR
}

export function loopDurationSec(bpm: number, loopBars: number): number {
  return barDurationSec(bpm) * loopBars
}

export async function decodeBlobToBuffer(
  ctx: BaseAudioContext,
  blob: Blob,
): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer()
  // decodeAudioData detaches/consumes the buffer in some implementations, so
  // callers must not reuse arrayBuffer after this call.
  return ctx.decodeAudioData(arrayBuffer.slice(0))
}

/**
 * Trims or zero-pads `source` to exactly `targetDurationSec` so every
 * monster loop lines up on the same bar grid regardless of how long the
 * original recording/upload was.
 */
export function fitBufferToDuration(
  ctx: BaseAudioContext,
  source: AudioBuffer,
  targetDurationSec: number,
): AudioBuffer {
  const sampleRate = source.sampleRate
  const targetLength = Math.max(1, Math.round(targetDurationSec * sampleRate))
  const out = ctx.createBuffer(source.numberOfChannels, targetLength, sampleRate)
  const copyLength = Math.min(targetLength, source.length)
  for (let ch = 0; ch < source.numberOfChannels; ch++) {
    const data = source.getChannelData(ch)
    out.getChannelData(ch).set(data.subarray(0, copyLength))
  }
  return out
}

/**
 * Rotates the buffer's content by `offsetSec`, wrapping around the end, so
 * the loop appears to start at a different point without changing length.
 * Used for the per-monster trim/offset nudge.
 */
export function rotateBuffer(
  ctx: BaseAudioContext,
  source: AudioBuffer,
  offsetSec: number,
): AudioBuffer {
  const sampleRate = source.sampleRate
  const length = source.length
  if (length === 0) return source
  let shift = Math.round(offsetSec * sampleRate) % length
  if (shift < 0) shift += length
  if (shift === 0) return source
  const out = ctx.createBuffer(source.numberOfChannels, length, sampleRate)
  for (let ch = 0; ch < source.numberOfChannels; ch++) {
    const data = source.getChannelData(ch)
    const outData = out.getChannelData(ch)
    outData.set(data.subarray(shift), 0)
    outData.set(data.subarray(0, shift), length - shift)
  }
  return out
}

/** Renders a short metronome click into a tiny AudioBuffer so it can be
 * scheduled sample-accurately alongside loops instead of using oscillators
 * started/stopped from JS timers. */
export function renderClickBuffer(ctx: BaseAudioContext, accent: boolean): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const duration = 0.06
  const length = Math.round(duration * sampleRate)
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  const freq = accent ? 1760 : 1175
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    const envelope = Math.exp(-t * 55)
    data[i] = Math.sin(2 * Math.PI * freq * t) * envelope
  }
  return buffer
}
