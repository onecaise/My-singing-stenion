import { useRef, useState } from 'react'
import { BUILT_IN_BACKDROPS } from '../types'
import { useStage } from '../state/StageContext'
import { BackdropThumb } from './Backdrop'

export function BackdropPicker() {
  const { song, setBackdrop, uploadBackdrop } = useStage()
  const [open, setOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25"
      >
        🖼️ Backdrop
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-64 rounded-2xl bg-[#3a2a5c] p-3 shadow-2xl">
          <div className="grid grid-cols-3 gap-2">
            {BUILT_IN_BACKDROPS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setBackdrop(b)
                  setOpen(false)
                }}
                className={`h-14 rounded-lg ring-2 ${
                  song.backdrop.kind === 'builtin' && song.backdrop.id === b.id ? 'ring-amber-300' : 'ring-transparent'
                }`}
                title={b.name}
              >
                <BackdropThumb backdropId={b.id} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 w-full rounded-full bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-400"
          >
            📁 Upload your own
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) {
                await uploadBackdrop(file)
                setOpen(false)
              }
              e.target.value = ''
            }}
          />
        </div>
      )}
    </div>
  )
}
