import { barDurationSec, loopDurationSec } from './buffers'
import { BEATS_PER_BAR } from '../types'

export interface VoiceInput {
  buffer: AudioBuffer
  /** wall-clock-stretch factor so the buffer's natural duration maps onto
   * the engine's current loop duration (see buffers.ts / voicePrep.ts) */
  playbackRate: number
  volume: number
  muted: boolean
  soloed: boolean
}

interface Voice {
  source: AudioBufferSourceNode
  gain: GainNode
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

/**
 * Owns the single AudioContext and the bar-aligned transport clock.
 * Deliberately has no React/UI dependencies so it can be unit tested and
 * reused by the recorder and exporter.
 */
export class StewnionAudioEngine {
  private _ctx: AudioContext | null = null
  private _master: GainNode | null = null
  private voices = new Map<string, Voice>()
  private transportStartTime: number | null = null
  bpm = 100
  loopBars = 2

  get ctx(): AudioContext {
    if (!this._ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this._ctx = new Ctor()
      this._master = this._ctx.createGain()
      this._master.gain.value = 0.9
      this._master.connect(this._ctx.destination)
    }
    return this._ctx
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
    source.connect(gain).connect(this.master)
    source.start(startAt)
    this.voices.set(id, { source, gain, volume: input.volume, muted: input.muted, soloed: input.soloed })
    this.applyGains()
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
  }

  stopAll(): void {
    for (const id of Array.from(this.voices.keys())) this.removeVoice(id)
    this.transportStartTime = null
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
