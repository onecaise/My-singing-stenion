import type { StewnionAudioEngine } from './engine'

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm']
  for (const type of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(type)) return type
  }
  return ''
}

/** Records the engine's master bus for `loops` repetitions of the current
 * global loop, starting cleanly on a bar boundary. Returns a webm blob. */
export async function exportMasterLoops(engine: StewnionAudioEngine, loops: number): Promise<Blob> {
  const ctx = engine.ctx
  const dest = ctx.createMediaStreamDestination()
  engine.master.connect(dest)

  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(dest.stream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const startAt = engine.nextBarBoundary()
  const duration = engine.loopDuration * loops

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      engine.master.disconnect(dest)
      resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }))
    }
  })

  window.setTimeout(() => recorder.start(), Math.max(0, (startAt - ctx.currentTime) * 1000))
  window.setTimeout(
    () => {
      if (recorder.state !== 'inactive') recorder.stop()
    },
    Math.max(0, (startAt - ctx.currentTime) * 1000) + duration * 1000,
  )

  return done
}
