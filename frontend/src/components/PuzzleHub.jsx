import { useState } from 'react'
import TrainingMode from './TrainingMode'

const FEATURED_CATEGORIES = [
  {
    id: 'daily',
    theme: 'mix',
    title: 'Daily Puzzle',
    subtitle: "Today's hand-picked challenge from Lichess",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
    accent: 'amber',
    badge: 'Daily',
    glow: 'rgba(245,158,11,0.15)',
    border: 'hover:border-amber-400/40',
    iconBg: 'bg-amber-500/12 text-amber-400 border-amber-500/20',
    pill: 'bg-amber-500/15 text-amber-300 border-amber-500/25'
  },
  {
    id: 'rush',
    theme: 'mix',
    title: 'Puzzle Rush',
    subtitle: 'Solve as many puzzles as you can in 5 minutes',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
      </svg>
    ),
    accent: 'rose',
    badge: 'Timed',
    glow: 'rgba(244,63,94,0.15)',
    border: 'hover:border-rose-400/40',
    iconBg: 'bg-rose-500/12 text-rose-400 border-rose-500/20',
    pill: 'bg-rose-500/15 text-rose-300 border-rose-500/25'
  },
  {
    id: 'mate',
    theme: 'mate',
    title: 'Checkmate Patterns',
    subtitle: 'Train your ability to spot forced checkmates',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
    accent: 'red',
    badge: 'Tactics',
    glow: 'rgba(239,68,68,0.15)',
    border: 'hover:border-red-400/40',
    iconBg: 'bg-red-500/12 text-red-400 border-red-500/20',
    pill: 'bg-red-500/15 text-red-300 border-red-500/25'
  }
]

const THEME_CATEGORIES = [
  { theme: 'fork',             label: 'Fork',             icon: '⚔️', hoverBorder: 'hover:border-cyan-400/40',    hoverText: 'group-hover:text-cyan-400' },
  { theme: 'pin',              label: 'Pin',              icon: '📌', hoverBorder: 'hover:border-blue-400/40',    hoverText: 'group-hover:text-blue-400' },
  { theme: 'skewer',           label: 'Skewer',           icon: '🗡️', hoverBorder: 'hover:border-violet-400/40', hoverText: 'group-hover:text-violet-400' },
  { theme: 'mateIn1',          label: 'Mate in 1',        icon: '♚',  hoverBorder: 'hover:border-red-400/40',    hoverText: 'group-hover:text-red-400' },
  { theme: 'mateIn2',          label: 'Mate in 2',        icon: '♟️', hoverBorder: 'hover:border-rose-400/40',   hoverText: 'group-hover:text-rose-400' },
  { theme: 'endgame',          label: 'Endgame',          icon: '🏁', hoverBorder: 'hover:border-emerald-400/40',hoverText: 'group-hover:text-emerald-400' },
  { theme: 'opening',          label: 'Opening',          icon: '📖', hoverBorder: 'hover:border-amber-400/40',  hoverText: 'group-hover:text-amber-400' },
  { theme: 'discoveredAttack', label: 'Discovered',       icon: '👁️', hoverBorder: 'hover:border-purple-400/40', hoverText: 'group-hover:text-purple-400' },
  { theme: 'sacrifice',        label: 'Sacrifice',        icon: '🎯', hoverBorder: 'hover:border-orange-400/40', hoverText: 'group-hover:text-orange-400' },
  { theme: 'middlegame',       label: 'Middlegame',       icon: '⚡', hoverBorder: 'hover:border-yellow-400/40', hoverText: 'group-hover:text-yellow-400' },
  { theme: 'hangingPiece',     label: 'Hanging Piece',    icon: '🎪', hoverBorder: 'hover:border-teal-400/40',   hoverText: 'group-hover:text-teal-400' },
  { theme: 'pawnEndgame',      label: 'Pawn Ending',      icon: '♙',  hoverBorder: 'hover:border-lime-400/40',   hoverText: 'group-hover:text-lime-400' }
]

function PuzzleHub() {
  const [activeTheme, setActiveTheme] = useState(null)

  if (activeTheme !== null) {
    return (
      <div className='space-y-3'>
        <button
          onClick={() => setActiveTheme(null)}
          className='flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white'
        >
          <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10 19l-7-7m0 0l7-7m-7 7h18' />
          </svg>
          Back to Puzzles
        </button>
        <TrainingMode initialTheme={activeTheme} />
      </div>
    )
  }

  return (
    <div className='chess-page'>
      {/* Hero */}
      <div className='chess-hero relative overflow-hidden'>
        <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_5%_0%,rgba(244,63,94,0.18),transparent_55%)]' />
        <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_60%_at_95%_100%,rgba(245,158,11,0.12),transparent_55%)]' />
        <div className='relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8'>
          <div>
            <p className='mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-rose-400'>Chess Puzzles</p>
            <h1 className='text-3xl font-extrabold tracking-tight text-white md:text-4xl'>Train Your Tactics</h1>
            <p className='mt-2 max-w-lg text-sm text-slate-300 md:text-base'>
              Sharpen your chess instincts with curated puzzles from elite grandmaster games. Every pattern you see, you own forever.
            </p>
            <button
              onClick={() => setActiveTheme('mix')}
              className='mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition hover:-translate-y-0.5 hover:brightness-110'
            >
              <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' className='h-4 w-4'>
                <path d='m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z' />
              </svg>
              Start Solving
            </button>
          </div>
          <div className='hidden h-36 w-36 text-rose-500/20 md:block'>
            <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='0.6' className='h-full w-full'>
              <circle cx='12' cy='12' r='10' />
              <circle cx='12' cy='12' r='7' />
              <circle cx='12' cy='12' r='4' />
              <circle cx='12' cy='12' r='1.5' fill='currentColor' />
            </svg>
          </div>
        </div>
      </div>

      {/* Featured cards */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        {FEATURED_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveTheme(cat.theme)}
            className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1e1e1e] p-6 text-left transition-all hover:-translate-y-0.5 hover:bg-[#252526] ${cat.border}`}
          >
            <div className='pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100' style={{ background: `radial-gradient(ellipse 80% 80% at 10% 10%, ${cat.glow}, transparent 70%)` }} />
            <div className={`relative mb-4 flex h-12 w-12 items-center justify-center rounded-xl border ${cat.iconBg}`}>
              {cat.icon}
            </div>
            <div className='relative flex items-center gap-2 mb-2'>
              <h3 className='text-lg font-bold text-white transition-colors'>{cat.title}</h3>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${cat.pill}`}>{cat.badge}</span>
            </div>
            <p className='relative text-sm text-slate-400 mb-5'>{cat.subtitle}</p>
            <div className='relative mt-auto flex items-center gap-1.5 text-sm font-bold text-slate-400 transition-all group-hover:gap-2.5 group-hover:text-slate-200'>
              Start solving
              <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4 transition-transform group-hover:translate-x-1' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' /></svg>
            </div>
          </button>
        ))}
      </div>

      {/* Theme grid */}
      <div>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-lg font-bold text-white'>Browse by Theme</h2>
          <button
            onClick={() => setActiveTheme('mix')}
            className='text-sm font-semibold text-rose-400 transition hover:text-rose-300'
          >
            All themes →
          </button>
        </div>
        <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4'>
          {THEME_CATEGORIES.map((cat) => (
            <button
              key={cat.theme}
              onClick={() => setActiveTheme(cat.theme)}
              className={`group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#1e1e1e] p-3.5 text-left transition hover:-translate-y-0.5 hover:bg-[#252526] ${cat.hoverBorder}`}
            >
              <span className='text-xl'>{cat.icon}</span>
              <span className={`text-sm font-semibold text-slate-400 transition-colors ${cat.hoverText}`}>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats strip */}
      <div className='rounded-2xl border border-white/[0.08] bg-[#1e1e1e] px-6 py-5'>
        <p className='mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-600'>Your Stats</p>
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
          {[
            { label: 'Daily Streak', value: '—', sub: 'days', color: 'text-amber-300' },
            { label: 'Solved Today', value: '—', sub: 'puzzles', color: 'text-emerald-300' },
            { label: 'Best Streak', value: '—', sub: 'days', color: 'text-rose-300' },
            { label: 'Accuracy', value: '—', sub: '%', color: 'text-cyan-300' }
          ].map(({ label, value, sub, color }) => (
            <div key={label} className='rounded-xl border border-white/[0.06] bg-[#252526] px-4 py-3 text-center'>
              <p className={`text-2xl font-extrabold tabular-nums ${color}`}>{value}</p>
              <p className='mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600'>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PuzzleHub
