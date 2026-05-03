import { useEffect, useMemo, useState } from 'react'

// Local fallback daily puzzle (self-contained, inspired by lichess daily)
const LOCAL_DAILY_PUZZLE = {
  puzzle: {
    id: 'local-daily-1',
    fen: '6k1/5ppp/8/8/8/6Q1/5PPP/6K1 w - - 0 1',
    rating: 950,
    plays: 42,
    themes: ['mate', 'endgame']
  },
  game: {
    perf: { name: 'Practice' },
    players: [{ color: 'white', name: 'White' }, { color: 'black', name: 'Black' }]
  }
}

function PuzzleCard({ onOpenPuzzles }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dailyPuzzle, setDailyPuzzle] = useState(null)

  const puzzleUrl = useMemo(() => {
    const id = dailyPuzzle?.puzzle?.id
    return id ? `#/learn/puzzle/${id}` : '#/learn/puzzle'
  }, [dailyPuzzle])

  const loadDailyPuzzle = async () => {
    setLoading(true)
    setError('')

    try {
      // Use local daily puzzle to avoid external Lichess dependency
      await new Promise((r) => setTimeout(r, 250))
      setDailyPuzzle(LOCAL_DAILY_PUZZLE)
    } catch (e) {
      setError(e?.message || 'Failed to load daily puzzle')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDailyPuzzle()
  }, [])

  const puzzle = dailyPuzzle?.puzzle || null
  const game = dailyPuzzle?.game || null
  const themes = Array.isArray(puzzle?.themes) ? puzzle.themes.slice(0, 5) : []

  return (
    <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-5 backdrop-blur'>
      <div className='mb-3 flex items-center justify-between'>
        <h3 className='text-lg font-semibold text-white'>Puzzle Hub</h3>
        <span className='rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200'>Live</span>
      </div>

      {loading && <p className='text-sm text-slate-400'>Loading daily puzzle...</p>}
      {!loading && error && <p className='text-sm text-red-300'>{error}</p>}

      {!loading && !error && puzzle && (
        <div className='space-y-2 text-sm text-slate-300'>
          <div className='rounded-lg bg-[#2d2d30] px-3 py-2'>
            Daily ID: <span className='font-semibold text-white'>{puzzle.id}</span>
          </div>
          <div className='rounded-lg bg-[#2d2d30] px-3 py-2'>
            Rating: <span className='font-semibold text-white'>{puzzle.rating || '-'}</span> | Plays: <span className='font-semibold text-white'>{puzzle.plays || '-'}</span>
          </div>
          <div className='rounded-lg bg-[#2d2d30] px-3 py-2'>
            Perf: <span className='font-semibold text-white'>{game?.perf?.name || '-'}</span>
          </div>
          {!!themes.length && (
            <div className='flex flex-wrap gap-1.5 pt-1'>
              {themes.map((theme) => (
                <span key={theme} className='rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-200'>
                  {theme}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className='mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <button
          onClick={() => {
            if (typeof onOpenPuzzles === 'function') onOpenPuzzles()
          }}
          className='rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-2.5 font-medium text-white transition hover:brightness-110'
        >
          Open Puzzle Hub
        </button>
        <button
          onClick={loadDailyPuzzle}
          disabled={loading}
          className='rounded-xl border border-white/15 px-4 py-2.5 font-medium text-slate-100 transition hover:border-cyan-300/60 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60'
        >
          Refresh Daily
        </button>
      </div>

      <a
        href={puzzleUrl}
        target='_blank'
        rel='noreferrer'
        className='mt-3 inline-block text-xs font-semibold text-cyan-300 transition hover:text-cyan-200'
      >
        Open Source Puzzle
      </a>
    </section>
  )
}

export default PuzzleCard
