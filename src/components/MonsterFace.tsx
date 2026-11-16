import { useEffect, useState } from 'react'
import { loadBlob } from '../storage/db'
import type { Monster } from '../types'

export function MonsterFace({ monster, size = 64 }: { monster: Pick<Monster, 'color' | 'emoji' | 'imageBlobKey'>; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!monster.imageBlobKey) {
      setUrl(null)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    loadBlob(monster.imageBlobKey).then((blob) => {
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [monster.imageBlobKey])

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white/80 shadow-md"
      style={{ width: size, height: size, background: monster.color }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span style={{ fontSize: size * 0.55 }}>{monster.emoji}</span>
      )}
    </div>
  )
}
