import { useState } from 'react'
import { TopNav, type PanelId } from './components/TopNav'
import { MonstersPanel } from './panels/MonstersPanel'
import { SongPanel } from './panels/SongPanel'
import { MonstersProvider } from './state/MonstersContext'
import { StageProvider } from './state/StageContext'

function App() {
  const [panel, setPanel] = useState<PanelId>('monsters')

  return (
    <MonstersProvider>
      <StageProvider>
        <div className="flex h-screen w-screen flex-col bg-[#241a3b]">
          <TopNav active={panel} onChange={setPanel} />
          <main className="min-h-0 flex-1">
            <div className={panel === 'monsters' ? 'h-full' : 'hidden'}>
              <MonstersPanel />
            </div>
            <div className={panel === 'song' ? 'h-full' : 'hidden'}>
              <SongPanel />
            </div>
          </main>
        </div>
      </StageProvider>
    </MonstersProvider>
  )
}

export default App
