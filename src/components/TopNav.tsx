export type PanelId = 'monsters' | 'song'

export function TopNav({ active, onChange }: { active: PanelId; onChange: (p: PanelId) => void }) {
  const tabs: { id: PanelId; label: string; emoji: string }[] = [
    { id: 'monsters', label: 'Monsters', emoji: '👾' },
    { id: 'song', label: 'Song', emoji: '🎵' },
  ]
  return (
    <nav className="flex shrink-0 items-center gap-3 bg-[#2a1f45] px-5 py-3 shadow-lg">
      <div className="mr-2 flex items-center gap-2 text-xl font-black tracking-tight text-amber-200 drop-shadow">
        <span>🎤</span>
        <span>My Singing Stewnion</span>
      </div>
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
              active === t.id
                ? 'scale-105 bg-amber-300 text-[#2a1f45] shadow-md'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            <span className="mr-1">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
