import { useEffect, useState } from 'react'
import { loadBlob } from '../storage/db'
import type { Backdrop as BackdropType } from '../types'

const BUILTIN_STYLES: Record<string, { gradient: string; blobs: { cx: number; cy: number; r: number; fill: string }[] }> = {
  meadow: {
    gradient: 'linear-gradient(180deg,#bdf2c9 0%,#79d98b 45%,#4fae68 100%)',
    blobs: [
      { cx: 15, cy: 85, r: 22, fill: '#3f9a57' },
      { cx: 50, cy: 92, r: 28, fill: '#368a4c' },
      { cx: 85, cy: 82, r: 20, fill: '#3f9a57' },
      { cx: 70, cy: 15, r: 10, fill: '#ffffffaa' },
      { cx: 25, cy: 20, r: 7, fill: '#ffffff88' },
    ],
  },
  reef: {
    gradient: 'linear-gradient(180deg,#8fe9ff 0%,#2ea3d6 50%,#146a9c 100%)',
    blobs: [
      { cx: 20, cy: 90, r: 24, fill: '#0f5a86' },
      { cx: 60, cy: 95, r: 30, fill: '#124f73' },
      { cx: 88, cy: 20, r: 12, fill: '#ffffff55' },
      { cx: 30, cy: 35, r: 8, fill: '#ffffff66' },
      { cx: 72, cy: 55, r: 6, fill: '#ffffff55' },
    ],
  },
  dusk: {
    gradient: 'linear-gradient(180deg,#ffd3e0 0%,#f497b0 40%,#c45c8b 100%)',
    blobs: [
      { cx: 80, cy: 18, r: 16, fill: '#fff0a855' },
      { cx: 10, cy: 88, r: 26, fill: '#a84a74' },
      { cx: 55, cy: 95, r: 32, fill: '#93416a' },
      { cx: 90, cy: 85, r: 18, fill: '#a84a74' },
    ],
  },
  cave: {
    gradient: 'linear-gradient(180deg,#4a3b63 0%,#2c2142 55%,#140f24 100%)',
    blobs: [
      { cx: 25, cy: 10, r: 6, fill: '#ffe9a3' },
      { cx: 60, cy: 18, r: 4, fill: '#ffe9a3' },
      { cx: 80, cy: 8, r: 5, fill: '#c6b7ff' },
      { cx: 15, cy: 90, r: 28, fill: '#1b1430' },
      { cx: 70, cy: 95, r: 34, fill: '#1b1430' },
    ],
  },
  nebula: {
    gradient: 'linear-gradient(180deg,#2a1b4a 0%,#5b2d7a 45%,#b15bb0 100%)',
    blobs: [
      { cx: 70, cy: 25, r: 14, fill: '#ff9ed8aa' },
      { cx: 20, cy: 40, r: 10, fill: '#9ed8ffaa' },
      { cx: 85, cy: 70, r: 20, fill: '#ffd79eaa' },
      { cx: 40, cy: 85, r: 30, fill: '#7a3b9c' },
    ],
  },
}

export function BackdropView({ backdrop, className = '' }: { backdrop: BackdropType; className?: string }) {
  const [customUrl, setCustomUrl] = useState<string | null>(null)

  useEffect(() => {
    if (backdrop.kind !== 'custom') {
      setCustomUrl(null)
      return
    }
    let url: string | null = null
    let cancelled = false
    loadBlob(backdrop.blobKey).then((blob) => {
      if (cancelled || !blob) return
      url = URL.createObjectURL(blob)
      setCustomUrl(url)
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [backdrop])

  if (backdrop.kind === 'custom') {
    return (
      <div
        className={`absolute inset-0 bg-cover bg-center ${className}`}
        style={{ backgroundImage: customUrl ? `url(${customUrl})` : undefined, backgroundColor: '#2c2142' }}
      />
    )
  }

  const style = BUILTIN_STYLES[backdrop.id] ?? BUILTIN_STYLES.meadow
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} style={{ background: style.gradient }}>
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        {style.blobs.map((b, i) => (
          <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={b.fill} />
        ))}
      </svg>
    </div>
  )
}

export function BackdropThumb({ backdropId }: { backdropId: string }) {
  const style = BUILTIN_STYLES[backdropId] ?? BUILTIN_STYLES.meadow
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg" style={{ background: style.gradient }}>
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        {style.blobs.map((b, i) => (
          <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={b.fill} />
        ))}
      </svg>
    </div>
  )
}
