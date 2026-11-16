import type { MonsterRole } from '../types'

export const ROLE_LABELS: Record<MonsterRole, string> = {
  bass: 'Bass',
  beat: 'Beat',
  chords: 'Chords / Hum',
  melody: 'Melody',
  fx: 'FX',
}

export const ALL_ROLES: MonsterRole[] = ['bass', 'beat', 'chords', 'melody', 'fx']

interface FilterSpec {
  type: BiquadFilterType
  frequency: number
  gain?: number
  q?: number
}

/** Each role's EQ chain, tuned so monsters sharing a stage carve out their
 * own frequency space instead of fighting for the same room. */
const ROLE_FILTER_SPECS: Record<MonsterRole, FilterSpec[]> = {
  bass: [
    { type: 'lowpass', frequency: 250, q: 0.7 },
    { type: 'peaking', frequency: 80, gain: 3, q: 1 },
  ],
  beat: [
    { type: 'highpass', frequency: 80, q: 0.7 },
    { type: 'peaking', frequency: 3000, gain: 3, q: 1 },
  ],
  chords: [
    { type: 'highpass', frequency: 200, q: 0.7 },
    { type: 'peaking', frequency: 3000, gain: -4, q: 0.7 },
  ],
  melody: [
    { type: 'highpass', frequency: 250, q: 0.7 },
    { type: 'peaking', frequency: 2500, gain: 3, q: 1 },
  ],
  fx: [{ type: 'highpass', frequency: 400, q: 0.7 }],
}

/** How much of each role's signal gets sent to the shared reverb, on top of
 * the small ambience already applied to the whole mix. FX leans on reverb
 * most since it has no dedicated frequency pocket of its own. */
export const ROLE_REVERB_SEND: Record<MonsterRole, number> = {
  bass: 0,
  beat: 0.03,
  chords: 0.08,
  melody: 0.08,
  fx: 0.3,
}

export function buildRoleFilterChain(ctx: BaseAudioContext, role: MonsterRole): BiquadFilterNode[] {
  return ROLE_FILTER_SPECS[role].map((spec) => {
    const filter = ctx.createBiquadFilter()
    filter.type = spec.type
    filter.frequency.value = spec.frequency
    filter.Q.value = spec.q ?? 0.707
    if (spec.gain !== undefined) filter.gain.value = spec.gain
    return filter
  })
}

function hash(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Bass and beat anchor the center; everything else spreads left/right so
 * monsters don't pile up in the same spot. `seed` (the monster id) keeps FX
 * monsters from all landing on the same side. */
export function defaultPanForRole(role: MonsterRole, seed: string): number {
  switch (role) {
    case 'bass':
    case 'beat':
      return 0
    case 'chords':
      return -0.35
    case 'melody':
      return 0.35
    case 'fx':
      return hash(seed) % 2 === 0 ? 0.55 : -0.55
  }
}

/** Auto-suggests a role from two cheap-to-compute features: how bright the
 * loop sounds (spectral centroid) and how percussive it is (onsets per
 * second). The user can always override it. */
export function suggestRole(spectralCentroidHz: number, onsetDensityPerSec: number): MonsterRole {
  if (onsetDensityPerSec > 2.5) return 'beat'
  if (spectralCentroidHz < 300) return 'bass'
  if (spectralCentroidHz > 3500) return 'fx'
  if (onsetDensityPerSec < 0.8) return 'chords'
  return 'melody'
}
