import { useRef } from 'react'

const COLORS = ['#ff7a7a', '#ffb347', '#ffe066', '#8ce99a', '#63e6be', '#74c0fc', '#b197fc', '#f783ac']
const EMOJIS = ['👾', '🐙', '🦕', '🐲', '🦋', '🐸', '🦑', '🐝', '🦖', '👹', '🦜', '🐳']

interface PictureInputProps {
  color: string
  emoji: string
  hasImage: boolean
  imagePreviewUrl: string | null
  onColorChange: (c: string) => void
  onEmojiChange: (e: string) => void
  onImageChange: (file: File | null) => void
}

export function PictureInput({ color, emoji, hasImage, imagePreviewUrl, onColorChange, onEmojiChange, onImageChange }: PictureInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex gap-4">
      <div
        className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white/80 shadow-md"
        style={{ background: color }}
      >
        {imagePreviewUrl ? (
          <img src={imagePreviewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span style={{ fontSize: 40 }}>{emoji}</span>
        )}
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-400"
          >
            📷 Upload photo
          </button>
          {hasImage && (
            <button
              type="button"
              onClick={() => onImageChange(null)}
              className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/25"
            >
              Remove photo
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onImageChange(file)
              e.target.value = ''
            }}
          />
        </div>
        {!hasImage && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onColorChange(c)}
                  className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'}`}
                  style={{ background: c }}
                  aria-label={`color ${c}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-1 text-lg">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onEmojiChange(e)}
                  className={`rounded-md px-1 ${emoji === e ? 'bg-white/25' : 'hover:bg-white/10'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
