import { barDurationSec, loopDurationSec, renderRoomImpulseResponse } from './buffers'
import { BEATS_PER_BAR } from '../types'

export interface VoiceInput {
  buffer: AudioBuffer
  /** wall-clock-stretch factor so the buffer's natural duration maps onto
   * the engine's current loop duration (see buffers.ts / voicePrep.ts) */
  playbackRate: number
  volume: number
  muted: boolean
  soloed: boolean
  /** linear gain applied so every monster matches the target loudness;
   * callers pass 1 when loudness matching is toggled off for this monster */
  loudnessGainLinear: number
}

interface Voice {
  source: AudioBufferSourceNode
  gain: GainNode
  loudnessGain: GainNode
  volume: number
  muted: boolean
  soloed: boolean
}

export interface BeatInfo {
  /** whole bars elapsed since the transport started */
  bar: number
  /** 0-indexed beat within the bar */
  beat: number
  /** 0..1 progress through the current beat */
  phaseInBeat: number
  /** 0..1 progress through the current global loop */
  loopPhase: number
}

const RAMP_SEC = 0.025

/** How much the master bus auto-ducks as more monsters join the stage, so
 * a crowded song doesn't get louder (and closer to clipping) than a sparse
 * one. Tuned gently so it's felt, not heard. */
function duckGainFor(voiceCount: number): number {
  if (voiceCount <= 1) return 1
  return Math.max(0.55, 1 - 0.06 * (voiceCount - 1))
}

/**
 * Owns the single AudioContext and the bar-aligned transport clock.
 * Deliberately has no React/UI dependencies so it can be unit tested and
 * reused by the recorder and exporter.
 */
export class StewnionAudioEngine {
  private _ctx: AudioContext | null = null
  /** sum of all voices, pre master-processing */
  private _voiceBus: GainNode | null = null
  /** auto-reduces as more monsters are added */
  private _duckGain: GainNode | null = null
  /** shared room reverb send, fed by the glue bus and by individual voices */
  private _convolver: ConvolverNode | null = null
  /** final user-facing volume control, after limiting */
  private _master: GainNode | null = null
  private voices = new Map<string, Voice>()
  private transportStartTime: number | null = null
  bpm = 100
  loopBars = 2

  get ctx(): AudioContext {
    if (!this._ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctor()
      this._ctx = ctx

      const voiceBus = ctx.createGain()
      const duckGain = ctx.createGain()
      duckGain.gain.value = 1
      const glueComp = ctx.createDynamicsCompressor()
      glueComp.ratio.value = 3
      glueComp.threshold.value = -18
      glueComp.knee.value = 12
      glueComp.attack.value = 0.02
      glueComp.release.value = 0.25

      const convolver = ctx.createConvolver()
      convolver.normalize = true
      convolver.buffer = renderRoomImpulseResponse(ctx)
      const reverbReturn = ctx.createGain()
      reverbReturn.gain.value = 0.8
      const sharedSend = ctx.createGain()
      sharedSend.gain.value = 0.1

      const limiterInput = ctx.createGain()
      const limiter = ctx.createDynamicsCompressor()
      limiter.ratio.value = 20
      limiter.threshold.value = -2
      limiter.knee.value = 0
      limiter.attack.value = 0.001
      limiter.release.value = 0.1

      const master = ctx.createGain()
      master.gain.value = 0.9

      voiceBus.connect(duckGain)
      duckGain.connect(glueComp)
      glueComp.connect(limiterInput)
      glueComp.connect(sharedSend)
      sharedSend.connect(convolver)
      convolver.connect(reverbReturn)
      reverbReturn.connect(limiterInput)
      limiterInput.connect(limiter)
      limiter.connect(master)
      master.connect(ctx.destination)

      this._voiceBus = voiceBus
      this._duckGain = duckGain
      this._convolver = convolver
      this._master = master
    }
    return this._ctx
  }

  /** Where voices should connect for the dry signal. */
  get voiceBus(): GainNode {
    void this.ctx
    return this._voiceBus!
  }

  /** Where a voice's individual reverb send should connect. */
  get reverbSendTarget(): ConvolverNode {
    void this.ctx
    return this._convolver!
  }

  get master(): GainNode {
    void this.ctx
    return this._master!
  }

  /** Must be called from a user gesture handler to satisfy autoplay policies. */
  async resume(): Promise<void> {
    const ctx = this.ctx
    if (ctx.state === 'suspended') await ctx.resume()
  }

  get isPlaying(): boolean {
    return this.transportStartTime !== null && this.voices.size > 0
  }

  get barDuration(): number {
    return barDurationSec(this.bpm)
  }

  get loopDuration(): number {
    return loopDurationSec(this.bpm, this.loopBars)
  }

  setBpm(bpm: number): void {
    this.bpm = bpm
  }

  setLoopBars(loopBars: number): void {
    this.loopBars = loopBars
  }

  setMasterVolume(v: number): void {
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01)
  }

  /** The AudioContext time of the next bar boundary on the shared transport
   * clock, establishing the clock if nothing is playing yet. */
  nextBarBoundary(): number {
    const ctx = this.ctx
    const now = ctx.currentTime
    const LATENCY = 0.08
    if (this.transportStartTime === null) {
      this.transportStartTime = now + LATENCY
      return this.transportStartTime
    }
    const bar = this.barDuration
    const elapsed = now - this.transportStartTime
    const k = Math.ceil(elapsed / bar - 1e-6)
    return this.transportStartTime + Math.max(k, 0) * bar
  }

  /** Adds (or replaces) a monster's loop, scheduled to join on the next bar.
   * Returns the AudioContext time (and `delayMs` from now) it will start,
   * so the UI can time a matching CSS animation start. */
  addVoice(id: string, input: VoiceInput): { startAt: number; delayMs: number } {
    this.removeVoice(id)
    const ctx = this.ctx
    const startAt = this.nextBarBoundary()
    const source = ctx.createBufferSource()
    source.buffer = input.buffer
    source.loop = true
    source.loopStart = 0
    source.loopEnd = input.buffer.duration
    source.playbackRate.value = input.playbackRate
    const gain = ctx.createGain()
    gain.gain.value = 0
    const loudnessGain = ctx.createGain()
    loudnessGain.gain.value = input.loudnessGainLinear
    source.connect(gain).connect(loudnessGain).connect(this.voiceBus)
    source.start(startAt)
    this.voices.set(id, { source, gain, loudnessGain, volume: input.volume, muted: input.muted, soloed: input.soloed })
    this.applyGains()
    this.updateDuckGain()
    return { startAt, delayMs: Math.max(0, (startAt - ctx.currentTime) * 1000) }
  }

  removeVoice(id: string): void {
    const voice = this.voices.get(id)
    if (!voice) return
    const now = this.ctx.currentTime
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setTargetAtTime(0, now, 0.015)
    const source = voice.source
    try {
      source.stop(now + RAMP_SEC * 3)
    } catch {
      // already stopped
    }
    this.voices.delete(id)
    this.updateDuckGain()
  }

  stopAll(): void {
    for (const id of Array.from(this.voices.keys())) this.removeVoice(id)
    this.transportStartTime = null
  }

  /** Auto-reduces the master bus gain a little as more monsters join, so a
   * crowded stage doesn't push the limiter harder than a sparse one. */
  private updateDuckGain(): void {
    const target = duckGainFor(this.voices.size)
    this._duckGain!.gain.setTargetAtTime(target, this.ctx.currentTime, 0.3)
  }

  setVolume(id: string, volume: number): void {
    const voice = this.voices.get(id)
    if (!voice) return
    voice.volume = volume
    this.applyGains()
  }

  setMuted(id: string, muted: boolean): void {
    const voice = this.voices.get(id)
    if (!voice) return
    voice.muted = muted
    this.applyGains()
  }

  /** Live-toggles loudness matching for one voice without rebuilding it,
   * so the user can A/B the "before" and "after" instantly. */
  setLoudnessGain(id: string, linearGain: number): void {
    const voice = this.voices.get(id)
    if (!voice) return
    voice.loudnessGain.gain.setTargetAtTime(linearGain, this.ctx.currentTime, 0.02)
  }

  setSoloed(id: string, soloed: boolean): void {
    const voice = this.voices.get(id)
    if (!voice) return
    voice.soloed = soloed
    this.applyGains()
  }

  private applyGains(): void {
    const anySoloed = Array.from(this.voices.values()).some((v) => v.soloed)
    const now = this.ctx.currentTime
    for (const voice of this.voices.values()) {
      const effectivelyMuted = voice.muted || (anySoloed && !voice.soloed)
      const target = effectivelyMuted ? 0 : voice.volume
      voice.gain.gain.cancelScheduledValues(now)
      voice.gain.gain.setTargetAtTime(target, now, 0.02)
    }
  }

  /** Pure read of where we are on the bar/beat grid right now, for driving
   * the beat indicator and per-monster bounce animations. Returns null when
   * nothing is playing. */
  getBeatInfo(): BeatInfo | null {
    if (this.transportStartTime === null) return null
    const now = this.ctx.currentTime
    const elapsed = Math.max(0, now - this.transportStartTime)
    const beatDur = this.barDuration / BEATS_PER_BAR
    const totalBeats = elapsed / beatDur
    const bar = Math.floor(totalBeats / BEATS_PER_BAR)
    const beat = Math.floor(totalBeats) % BEATS_PER_BAR
    const phaseInBeat = totalBeats - Math.floor(totalBeats)
    const loopPhase = (elapsed % this.loopDuration) / this.loopDuration
    return { bar, beat, phaseInBeat, loopPhase }
  }
}

export const engine = new StewnionAudioEngine()
