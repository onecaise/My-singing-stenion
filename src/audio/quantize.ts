import { detectOnsets } from './analysis'

/** Linearly resamples one segment of `source` (in samples, [start, end)) to
 * exactly `targetLength` samples per channel. Not pitch-preserving — fine
 * for nudging a short transient a few milliseconds, which is all Quantize
 * asks of it. */
function resampleSegment(source: AudioBuffer, start: number, end: number, targetLength: number): Float32Array[] {
  const length = Math.max(1, end - start)
  const channels: Float32Array[] = []
  for (let ch = 0; ch < source.numberOfChannels; ch++) {
    const data = source.getChannelData(ch)
    const out = new Float32Array(targetLength)
    for (let i = 0; i < targetLength; i++) {
      const srcPos = start + (i / targetLength) * length
      const i0 = Math.floor(srcPos)
      const i1 = Math.min(end - 1, i0 + 1)
      const frac = srcPos - i0
      const s0 = data[i0] ?? 0
      const s1 = data[i1] ?? 0
      out[i] = s0 + (s1 - s0) * frac
    }
    channels.push(out)
  }
  return channels
}

/**
 * Detects transients in `buffer` and nudges each one toward the nearest
 * grid line (an 8th or 16th note, by `gridStepSec`) by gently stretching or
 * squeezing the slice between onsets. Deliberately simple — a crude
 * resample rather than a pitch-preserving time-stretch — which is why
 * Quantize defaults to off and is easy to A/B against the original.
 */
export function quantizeBuffer(ctx: BaseAudioContext, buffer: AudioBuffer, gridStepSec: number): AudioBuffer {
  const onsets = detectOnsets(buffer)
  if (onsets.length === 0) return buffer

  const sampleRate = buffer.sampleRate
  const totalLength = buffer.length
  const boundarySamples = [0, ...onsets.map((t) => Math.round(t * sampleRate)), totalLength]

  const targetSamples = boundarySamples.map((sample, i) => {
    if (i === 0) return 0
    if (i === boundarySamples.length - 1) return totalLength
    const snappedSec = Math.round(sample / sampleRate / gridStepSec) * gridStepSec
    return Math.round(snappedSec * sampleRate)
  })
  // keep boundaries strictly increasing and inside the buffer
  for (let i = 1; i < targetSamples.length; i++) {
    targetSamples[i] = Math.max(targetSamples[i - 1] + 1, Math.min(totalLength, targetSamples[i]))
  }
  targetSamples[targetSamples.length - 1] = totalLength

  const out = ctx.createBuffer(buffer.numberOfChannels, totalLength, sampleRate)
  for (let seg = 0; seg < boundarySamples.length - 1; seg++) {
    const srcStart = boundarySamples[seg]
    const srcEnd = boundarySamples[seg + 1]
    const dstStart = targetSamples[seg]
    const dstEnd = targetSamples[seg + 1]
    const dstLength = dstEnd - dstStart
    if (srcEnd <= srcStart || dstLength <= 0) continue
    const resampled = resampleSegment(buffer, srcStart, srcEnd, dstLength)
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      out.getChannelData(ch).set(resampled[ch], dstStart)
    }
  }
  return out
}
