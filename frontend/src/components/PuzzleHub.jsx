import { useState } from 'react'
import TrainingMode from './TrainingMode'

// ── Category definitions ────────────────────────────────────────────────────
const FEATURED_CATEGORIES = [
  {
    id: 'daily',
    theme: 'mix',
    title: 'Daily Puzzle',
    subtitle: "Today's hand-picked challenge from Lichess",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
    color: 'amber',
    badge: 'Daily'
  },
  {
    id: 'rush',
    theme: 'mix',
    title: 'Puzzle Rush',
    subtitle: 'Solve as many puzzles as you can in 5 minutes',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
      </svg>
    ),
    color: 'rose',
    badge: 'Timed'
  },
  {
    id: 'mate',
    theme: 'mate',
    title: 'Checkmate Patterns',
    subtitle: 'Train your ability to spot forced checkmates',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
    color: 'red',
    badge: 'Tactics'
  }
]

const THEME_CATEGORIES = [
  { theme: 'fork', label: 'Fork', icon: '⚔️', color: 'cyan' },
  { theme: 'pin', label: 'Pin', icon: '📌', color: 'blue' },
  { theme: 'skewer', label: 'Skewer', icon: '🗡️', color: 'violet' },
  { theme: 'mateIn1', label: 'Mate in 1', icon: '♚', color: 'red' },
  { theme: 'mateIn2', label: 'Mate in 2', icon: '♟️', color: 'rose' },
  { theme: 'endgame', label: 'Endgame', icon: '🏁', color: 'emerald' },
  { theme: 'opening', label: 'Opening', icon: '📖', color: 'amber' },
  { theme: 'discoveredAttack', label: 'Discovered Attack', icon: '👁️', color: 'purple' },
  { theme: 'sacrifice', label: 'Sacrifice', icon: '🎯', color: 'orange' },
  { theme: 'middlegame', label: 'Middlegame', icon: '⚡', color: 'yellow' },
  { theme: 'hangingPiece', label: 'Hanging Piece', icon: '🎪', color: 'teal' },
  { theme: 'pawnEndgame', label: 'Pawn Ending', icon: '♙', color: 'lime' }
]

const themeColorMap = {
  amber: { border: 'hover:border-amber-400/40', text: 'group-hover:text-amber-400', pill: 'bg-amber-500/20 text-amber-300' },
  rose: { border: 'hover:border-rose-400/40', text: 'group-hover:text-rose-400', pill: 'bg-rose-500/20 text-rose-300' },
  red: { border: 'hover:border-red-400/40', text: 'group-hover:text-red-400', pill: 'bg-red-500/20 text-red-300' },
  cyan: { border: 'hover:border-cyan-400/40', text: 'group-hover:text-cyan-400' },
  blue: { border: 'hover:border-blue-400/40', text: 'group-hover:text-blue-400' },
  violet: { border: 'hover:border-violet-400/40', text: 'group-hover:text-violet-400' },
  emerald: { border: 'hover:border-emerald-400/40', text: 'group-hover:text-emerald-400' },
  purple: { border: 'hover:border-purple-400/40', text: 'group-hover:text-purple-400' },
  orange: { border: 'hover:border-orange-400/40', text: 'group-hover:text-orange-400' },
  yellow: { border: 'hover:border-yellow-400/40', text: 'group-hover:text-yellow-400' },
  teal: { border: 'hover:border-teal-400/40', text: 'group-hover:text-teal-400' },
  lime: { border: 'hover:border-lime-400/40', text: 'group-hover:text-lime-400' }
}

function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="mb-4 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      Back to Puzzles
    </button>
  )
}

function PuzzleHub() {
  const [activeTheme, setActiveTheme] = useState(null) // null = landing

  if (activeTheme !== null) {
    return (
      <div className="space-y-3">
        <BackButton onClick={() => setActiveTheme(null)} />
        <TrainingMode initialTheme={activeTheme} />
      </div>
    )
  }

  return (
    <div className="chess-page">
      {/* Hero */}
      <div className="chess-hero relative">
        <div className="absolute inset-0 bg-gradient-to-r from-rose-700/20 to-amber-700/15 pointer-events-none" />
        <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-rose-400 mb-2">Chess Puzzles</p>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-3">Train Your Tactics</h1>
            <p className="text-lg text-slate-300 max-w-xl mb-6">
              Sharpen your chess instincts with curated puzzles from elite grandmaster games. Every pattern you see, you own forever.
            </p>
            <button onClick={() => setActiveTheme('mix')} className="chess-btn-primary px-6 py-3 font-bold shadow-lg shadow-rose-500/25 transform hover:-translate-y-0.5">
              Start Solving ⚡
            </button>
          </div>
          <div className="hidden md:block w-44 h-44 opacity-70 flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" className="w-full h-full text-rose-400">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
          </div>
        </div>
      </div>

      {/* Featured cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {FEATURED_CATEGORIES.map((cat) => {
          const cls = themeColorMap[cat.color] || {}
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTheme(cat.theme)}
              className={`group flex flex-col items-start p-6 rounded-2xl border border-white/5 bg-[#252526] hover:bg-[#2d2d30] ${cls.border || ''} transition-all text-left shadow-lg`}
            >
              {cat.icon}
              <div className="flex items-center gap-2 mb-2">
                <h3 className={`text-xl font-bold text-white ${cls.text || ''} transition-colors`}>{cat.title}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cls.pill || 'bg-white/10 text-white/60'}`}>{cat.badge}</span>
              </div>
              <p className="text-sm text-slate-400 mb-4">{cat.subtitle}</p>
              <div className={`mt-auto text-sm font-bold text-slate-400 ${cls.text || ''} flex items-center gap-1 group-hover:translate-x-1 transition-transform`}>
                Start
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          )
        })}
      </div>

      {/* Themes grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Browse by Theme</h2>
          <button
            onClick={() => setActiveTheme('mix')}
            className="text-sm font-semibold text-rose-400 hover:text-rose-300 transition"
          >
            All themes →
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {THEME_CATEGORIES.map((cat) => {
            const cls = themeColorMap[cat.color] || {}
            return (
              <button
                key={cat.theme}
                onClick={() => setActiveTheme(cat.theme)}
                className={`group flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-[#252526] hover:bg-[#2d2d30] ${cls.border || ''} transition-all text-left`}
              >
                <span className="text-2xl flex-shrink-0">{cat.icon}</span>
                <span className={`text-sm font-semibold text-slate-300 ${cls.text || ''} transition-colors`}>{cat.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quick stats strip */}
      <div className="rounded-2xl border border-white/8 bg-[#1a1a1a] px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Daily Streak', value: '—', sub: 'days', color: 'text-amber-300' },
          { label: 'Solved Today', value: '—', sub: 'puzzles', color: 'text-emerald-300' },
          { label: 'Best Streak', value: '—', sub: 'days', color: 'text-rose-300' },
          { label: 'Accuracy', value: '—', sub: '%', color: 'text-cyan-300' }
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="text-center">
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PuzzleHub
