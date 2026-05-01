import { useEffect, useMemo, useState } from 'react'
import ChessBoard from './ChessBoard'
import { recordPlayPreset } from '../utils/progressApi'
import { useAuthStore } from '../store/useAuthStore'
import {
  createTournament,
  fetchTournamentById,
  fetchTournamentLeaderboard,
  fetchTournaments,
  joinTournament,
  startTournament
} from '../utils/tournamentApi'

const timePresets = [
  { id: '1+0', label: 'Bullet', detail: '1 min', category: 'bullet', baseTimeMs: 60000, incrementMs: 0 },
  { id: '2+1', label: 'Bullet', detail: '2+1', category: 'bullet', baseTimeMs: 120000, incrementMs: 1000 },
  { id: '3+0', label: 'Blitz', detail: '3 min', category: 'blitz', baseTimeMs: 180000, incrementMs: 0 },
  { id: '3+2', label: 'Blitz', detail: '3+2', category: 'blitz', baseTimeMs: 180000, incrementMs: 2000 },
  { id: '5+0', label: 'Blitz', detail: '5 min', category: 'blitz', baseTimeMs: 300000, incrementMs: 0 },
  { id: '10+0', label: 'Rapid', detail: '10 min', category: 'rapid', baseTimeMs: 600000, incrementMs: 0 },
  { id: '10+5', label: 'Rapid', detail: '10+5', category: 'rapid', baseTimeMs: 600000, incrementMs: 5000 },
  { id: '15+10', label: 'Rapid', detail: '15+10', category: 'rapid', baseTimeMs: 900000, incrementMs: 10000 },
  { id: '30+0', label: 'Classical', detail: '30 min', category: 'classical', baseTimeMs: 1800000, incrementMs: 0 },
  { id: '30+20', label: 'Classical', detail: '30+20', category: 'classical', baseTimeMs: 1800000, incrementMs: 20000 }
]

const categoryConfig = {
  bullet: { color: 'rose', label: 'Bullet', icon: '⚡' },
  blitz: { color: 'amber', label: 'Blitz', icon: '🔥' },
  rapid: { color: 'emerald', label: 'Rapid', icon: '⏱️' },
  classical: { color: 'cyan', label: 'Classical', icon: '♟️' }
}

const GAME_MODES = [
  {
    id: 'rated',
    name: 'Play Online',
    subtitle: 'Rated game — affects your rating',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
      </svg>
    ),
    color: 'emerald'
  },
  {
    id: 'casual',
    name: 'Casual Game',
    subtitle: 'Practice without rating stakes',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
      </svg>
    ),
    color: 'blue'
  },
  {
    id: 'friend',
    name: 'Play a Friend',
    subtitle: 'Send a private invite link',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
    color: 'purple'
  },
  {
    id: 'tournament',
    name: 'Tournament',
    subtitle: 'Arena-style Swiss pairings',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
      </svg>
    ),
    color: 'amber'
  }
]

const colorMap = {
  emerald: { border: 'hover:border-emerald-500/40', text: 'group-hover:text-emerald-400', arrow: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
  blue: { border: 'hover:border-blue-500/40', text: 'group-hover:text-blue-400', arrow: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300' },
  purple: { border: 'hover:border-purple-500/40', text: 'group-hover:text-purple-400', arrow: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300' },
  amber: { border: 'hover:border-amber-500/40', text: 'group-hover:text-amber-400', arrow: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300' }
}

function PlaySection({ socket, onReviewClick, onLearnClick }) {
  const [view, setView] = useState('menu') // 'menu' | 'board' | 'tournament'
  const [selectedPreset, setSelectedPreset] = useState('5+0')
  const [selectedMode, setSelectedMode] = useState('rated')
  const [tournaments, setTournaments] = useState([])
  const [selectedTournamentId, setSelectedTournamentId] = useState('')
  const [leaderboard, setLeaderboard] = useState([])
  const [tournamentName, setTournamentName] = useState('Arena Night')
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [tournamentStatus, setTournamentStatus] = useState('')
  const [tournamentLoading, setTournamentLoading] = useState(false)
  const [assignedTournamentGameId, setAssignedTournamentGameId] = useState('')
  const authUser = useAuthStore((state) => state.user)

  const selectedPresetMeta = useMemo(
    () => timePresets.find((preset) => preset.id === selectedPreset) || timePresets[4],
    [selectedPreset]
  )

  useEffect(() => {
    recordPlayPreset({ timeControl: selectedPreset }).catch(() => {})
  }, [selectedPreset])

  // Load tournaments when in tournament view
  useEffect(() => {
    if (view !== 'tournament') return undefined
    let canceled = false
    const load = async () => {
      setTournamentLoading(true)
      try {
        const rows = await fetchTournaments()
        if (canceled) return
        setTournaments(Array.isArray(rows) ? rows : [])
      } catch (error) {
        if (canceled) return
        setTournamentStatus(error.message || 'Failed to load tournaments')
      } finally {
        if (!canceled) setTournamentLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 8000)
    return () => { canceled = true; clearInterval(interval) }
  }, [view])

  useEffect(() => {
    if (!selectedTournamentId) { setLeaderboard([]); setAssignedTournamentGameId(''); return undefined }
    let canceled = false
    const loadTournament = async () => {
      try {
        const [rows, tournament] = await Promise.all([
          fetchTournamentLeaderboard(selectedTournamentId),
          fetchTournamentById(selectedTournamentId)
        ])
        if (canceled) return
        setLeaderboard(Array.isArray(rows) ? rows : [])
        const participant = (tournament?.participants || []).find(
          (row) => String(row.userId) === String(authUser?.id)
        )
        setAssignedTournamentGameId(String(participant?.activeGameId || ''))
      } catch { if (canceled) return; setLeaderboard([]); setAssignedTournamentGameId('') }
    }
    loadTournament()
    const interval = setInterval(loadTournament, 5000)
    return () => { canceled = true; clearInterval(interval) }
  }, [selectedTournamentId, authUser?.id])

  const selectedTournament = useMemo(
    () => tournaments.find((row) => String(row._id) === String(selectedTournamentId)) || null,
    [tournaments, selectedTournamentId]
  )

  const createTournamentAction = async () => {
    setTournamentStatus('')
    try {
      const created = await createTournament({
        name: tournamentName, durationMinutes,
        timeControl: { preset: selectedPresetMeta.id, category: selectedPresetMeta.category, baseTimeMs: selectedPresetMeta.baseTimeMs, incrementMs: selectedPresetMeta.incrementMs }
      })
      setTournamentStatus('Tournament created')
      const rows = await fetchTournaments()
      setTournaments(Array.isArray(rows) ? rows : [])
      setSelectedTournamentId(created?._id || '')
    } catch (error) { setTournamentStatus(error.message || 'Failed to create tournament') }
  }

  const joinTournamentAction = async () => {
    if (!selectedTournamentId) return
    setTournamentStatus('')
    try {
      await joinTournament(selectedTournamentId)
      setTournamentStatus('Joined tournament')
      const rows = await fetchTournaments()
      setTournaments(Array.isArray(rows) ? rows : [])
    } catch (error) { setTournamentStatus(error.message || 'Failed to join tournament') }
  }

  const startTournamentAction = async () => {
    if (!selectedTournamentId) return
    setTournamentStatus('')
    try {
      await startTournament(selectedTournamentId)
      setTournamentStatus('Tournament started')
      const rows = await fetchTournaments()
      setTournaments(Array.isArray(rows) ? rows : [])
    } catch (error) { setTournamentStatus(error.message || 'Failed to start tournament') }
  }

  // ── Board sub-view ──
  if (view === 'board') {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden space-y-3">
        <button
          onClick={() => setView('menu')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Play
        </button>
        <div className="flex items-center gap-3 mb-1 flex-shrink-0">
          <span className="text-sm text-slate-400">{selectedPresetMeta.detail}</span>
          <span className="rounded bg-[#2d2d30] px-2 py-0.5 text-xs font-semibold text-slate-300">{selectedPresetMeta.label}</span>
          <span className="rounded bg-[#2d2d30] px-2 py-0.5 text-xs font-semibold text-slate-300 capitalize">{selectedMode}</span>
        </div>
        <div id="play-live-board" className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <ChessBoard
            socket={socket}
            externalJoinGameId={''}
            initialMatchConfig={{
              gameMode: selectedMode,
              timeControl: {
                preset: selectedPresetMeta.id,
                category: selectedPresetMeta.category,
                baseTimeMs: selectedPresetMeta.baseTimeMs,
                incrementMs: selectedPresetMeta.incrementMs
              }
            }}
          />
        </div>
      </div>
    )
  }

  // ── Tournament sub-view ──
  if (view === 'tournament') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setView('menu')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Play
        </button>
        <div className="rounded-2xl border border-white/10 bg-[#252526] p-6 space-y-6">
          <h2 className="text-2xl font-bold text-white">Tournament Arena</h2>
          {/* Create */}
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 space-y-3">
            <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wide">Create Tournament</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input value={tournamentName} onChange={(e) => setTournamentName(e.target.value)}
                placeholder="Tournament name"
                className="rounded-xl border border-white/10 bg-[#1e1e1e] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-400/50 focus:outline-none" />
              <input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} min={5} max={180}
                placeholder="Duration (min)"
                className="rounded-xl border border-white/10 bg-[#1e1e1e] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-400/50 focus:outline-none" />
              <button onClick={createTournamentAction}
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-400 transition">
                Create
              </button>
            </div>
          </div>
          {/* List */}
          {tournamentLoading && <p className="text-sm text-slate-400">Loading tournaments…</p>}
          {!tournamentLoading && tournaments.length === 0 && <p className="text-sm text-slate-400">No open tournaments. Create one above!</p>}
          <div className="space-y-2">
            {tournaments.map((t) => (
              <div key={t._id}
                onClick={() => setSelectedTournamentId(String(t._id))}
                className={`cursor-pointer rounded-xl border p-4 transition ${selectedTournamentId === String(t._id) ? 'border-amber-400 bg-amber-500/10' : 'border-white/10 bg-[#1e1e1e] hover:border-white/20'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{t.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${t.status === 'ongoing' ? 'bg-emerald-500/20 text-emerald-300' : t.status === 'finished' ? 'bg-slate-500/20 text-slate-400' : 'bg-amber-500/20 text-amber-300'}`}>{t.status}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{t.timeControl?.preset} • {t.participants?.length || 0} players</p>
              </div>
            ))}
          </div>
          {selectedTournamentId && (
            <div className="flex flex-wrap gap-3">
              <button onClick={joinTournamentAction} className="rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-500/15 transition">Join</button>
              <button onClick={startTournamentAction} className="rounded-xl border border-amber-400/40 px-4 py-2 text-sm font-bold text-amber-300 hover:bg-amber-500/15 transition">Start</button>
              {assignedTournamentGameId && (
                <button onClick={() => { setSelectedMode('tournament'); setView('board') }}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-400 transition">
                  Resume Game
                </button>
              )}
            </div>
          )}
          {leaderboard.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-amber-300 mb-2">Leaderboard</h4>
              <div className="space-y-1">
                {leaderboard.slice(0, 10).map((row, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-[#1e1e1e] px-3 py-2 text-sm">
                    <span className="text-slate-400 w-6">#{i + 1}</span>
                    <span className="text-white flex-1">{row.username}</span>
                    <span className="text-amber-300 font-bold">{row.points ?? 0}pt</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tournamentStatus && <p className="text-sm font-semibold text-emerald-300">{tournamentStatus}</p>}
        </div>
      </div>
    )
  }

  // ── Landing page (menu) ──
  const categories = ['bullet', 'blitz', 'rapid', 'classical']

  return (
    <div className="chess-page">
      {/* Hero */}
      <div className="chess-hero relative">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-700/20 to-cyan-700/20 pointer-events-none" />
        <div className="relative p-8 md:p-12">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2">Play Chess</p>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-3">Ready to Play?</h1>
          <p className="text-lg text-slate-300 max-w-xl mb-8">Choose your time control, pick a mode, and jump right in.</p>

          {/* Time control selector */}
          <div className="space-y-4">
            {categories.map((cat) => {
              const cfg = categoryConfig[cat]
              const presets = timePresets.filter((p) => p.category === cat)
              return (
                <div key={cat} className="flex items-center gap-3 flex-wrap">
                  <span className="w-24 flex items-center gap-2 text-sm font-bold text-slate-400">
                    <span>{cfg.icon}</span> {cfg.label}
                  </span>
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPreset(p.id)}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                        selectedPreset === p.id
                          ? `border-${cfg.color}-400 bg-${cfg.color}-500/20 text-${cfg.color}-200 shadow-lg shadow-${cfg.color}-500/10`
                          : 'border-white/10 bg-[#252526] text-slate-300 hover:border-white/20 hover:bg-[#2d2d30]'
                      }`}
                    >
                      {p.detail}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mode cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GAME_MODES.map((mode) => {
          const cls = colorMap[mode.color]
          return (
            <button
              key={mode.id}
              onClick={() => {
                if (mode.id === 'tournament') { setView('tournament'); return }
                if (mode.id === 'bot') { if (typeof onLearnClick === 'function') { onLearnClick(); return } }
                setSelectedMode(mode.id)
                setView('board')
              }}
              className={`group flex flex-col items-start p-6 rounded-2xl border border-white/5 bg-[#252526] hover:bg-[#2d2d30] ${cls.border} transition-all text-left shadow-lg`}
            >
              {mode.icon}
              <h3 className={`text-xl font-bold text-white mb-1 ${cls.text} transition-colors`}>{mode.name}</h3>
              <p className="text-sm text-slate-400 mb-4">{mode.subtitle}</p>
              <div className={`mt-auto text-sm font-bold ${cls.arrow} flex items-center gap-1 group-hover:translate-x-1 transition-transform`}>
                Play now
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          )
        })}
      </div>

      {/* Quick-start strip */}
      <div className="chess-card px-6 py-4 flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Quick start</p>
          <p className="text-white font-semibold">
            {selectedPresetMeta.label} · {selectedPresetMeta.detail}
            <span className="ml-2 text-xs text-slate-400">Selected</span>
          </p>
        </div>
        <button
          onClick={() => { setSelectedMode('rated'); setView('board') }}
          className="chess-btn-primary px-8 py-3 text-base font-bold shadow-lg shadow-emerald-500/25 transform hover:-translate-y-0.5"
        >
          Play now ⚡
        </button>
      </div>
    </div>
  )
}

export default PlaySection
