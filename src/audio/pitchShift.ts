import { fitBufferToDuration } from './buffers'

/**
 * Shifts `buffer`'s pitch by `semitones` and re-fits it back to its
 * original duration (trim/pad), so the loop still tiles on the same bar
 * grid afterward. This is a simple resample-based transpose rather than a
 * pitch-preserving time-stretch, which is why Snap to Key is only offered
 * for a few semitones at most — plenty for nudging a loop into key without
 * audibly speeding it up or slowing it down.
 */
export function pitchShiftBuffer(ctx: BaseAudioContext, buffer: AudioBuffer, semitones: number): AudioBuffer {
  if (semitones === 0) return buffer
  const ratio = Math.pow(2, semitones / 12)
  const sampleRate = buffer.sampleRate
  const originalLength = buffer.length
  const resampledLength = Math.max(1, Math.round(originalLength / ratio))
  const resampled = ctx.createBuffer(buffer.numberOfChannels, resampledLength, sampleRate)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    const out = resampled.getChannelData(ch)
    for (let i = 0; i < resampledLength; i++) {
      const srcPos = i * ratio
      const i0 = Math.floor(srcPos)
      const i1 = Math.min(originalLength - 1, i0 + 1)
      const frac = srcPos - i0
      const s0 = data[i0] ?? 0
      const s1 = data[i1] ?? 0
      out[i] = s0 + (s1 - s0) * frac
    }
  }
  return fitBufferToDuration(ctx, resampled, originalLength / sampleRate)
}
