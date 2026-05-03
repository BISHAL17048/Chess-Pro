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
      {/* Hero */}
      <div className='relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1e1e1e]'>
        <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_0%_0%,rgba(239,68,68,0.12),transparent_60%)]' />
        <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_60%_at_100%_100%,rgba(234,179,8,0.08),transparent_60%)]' />
        <div className='relative px-6 py-5 md:px-8'>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <p className='text-[11px] font-bold uppercase tracking-[0.2em] text-rose-400 mb-1'>Watch</p>
              <h1 className='text-2xl font-bold text-white md:text-3xl'>Live Games & Broadcasts</h1>
              <p className='mt-1 text-sm text-slate-400'>Follow top games, events, and chess video streams in real time.</p>
            </div>
            <div className='flex items-center gap-2'>
              <span className='flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-300'>
                <span className='h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse' />
                Live
              </span>
              <span className='rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300'>Broadcast</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className='rounded-xl border border-white/[0.08] bg-[#1e1e1e] p-1.5'>
        <div className='flex flex-wrap gap-1.5'>
          {WATCH_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'border-rose-400/40 bg-rose-500/12 text-rose-200 shadow-sm'
                  : 'border-white/[0.07] bg-[#252526] text-slate-400 hover:border-white/15 hover:text-slate-200'
              ].join(' ')}
            >
              {tab.id === 'live' && (
                <span className={`h-1.5 w-1.5 rounded-full ${activeTab === 'live' ? 'bg-rose-400 animate-pulse' : 'bg-slate-600'}`} />
              )}
              {tab.id === 'videos' && (
                <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' className='h-3.5 w-3.5'>
                  <path d='M15 10l4.553-2.277A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z' />
                </svg>
              )}
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
