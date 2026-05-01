import { useState } from 'react'
import LichessWatch from './LichessWatch'
import WatchVideos from './WatchVideos'

const WATCH_TABS = [
  { id: 'live', label: 'Live Games' },
  { id: 'videos', label: 'Chess Videos' }
]

function WatchSection({ socket }) {
  const [activeTab, setActiveTab] = useState('live')

  return (
    <section className='space-y-4'>
      <div className='rounded-xl border border-white/10 bg-[#252526]/90 p-2 backdrop-blur'>
        <div className='flex flex-wrap gap-2'>
          {WATCH_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${activeTab === tab.id ? 'border-cyan-300/70 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-[#2d2d30] text-slate-300 hover:border-white/25'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'live' ? <LichessWatch socket={socket} /> : <WatchVideos />}
    </section>
  )
}

export default WatchSection
