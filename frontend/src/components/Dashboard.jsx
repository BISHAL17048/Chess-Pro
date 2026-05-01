import { useEffect, useState } from 'react'
import PlayCard from './PlayCard'
import GameList from './GameList'
import PuzzleCard from './PuzzleCard'
import { fetchLiveFideRatings } from '../utils/lichessApi'

const currentGames = [
  { id: 'cg1', name: 'vs. NightFox', subtitle: '02:18 remaining' },
  { id: 'cg2', name: 'vs. CaroMaster', subtitle: '05:42 remaining' }
]

const recentGames = [
  { id: 'rg1', name: 'vs. QueenTrap', subtitle: 'Sicilian Defense', result: 'Win' },
  { id: 'rg2', name: 'vs. EndgamePro', subtitle: 'Ruy Lopez', result: 'Loss' },
  { id: 'rg3', name: 'vs. TacticNinja', subtitle: 'French Defense', result: 'Win' }
]

const tournaments = [
  { id: 't1', name: 'Weekend Arena', subtitle: '324 players • starts in 18m' },
  { id: 't2', name: 'Rapid Cup', subtitle: '128 players • live now' }
]

const friends = [
  { id: 'f1', name: 'Nadia', rating: 1724 },
  { id: 'f2', name: 'Dani', rating: 1650 },
  { id: 'f3', name: 'Ari', rating: 1902 }
]

const RATING_TYPES = [
  { key: 'classical', label: 'Classical' },
  { key: 'rapid', label: 'Rapid' },
  { key: 'blitz', label: 'Blitz' }
]

function SkeletonCard() {
  return (
    <div className='h-40 animate-pulse rounded-2xl border border-white/10 bg-[#252526]/80'>
      <div className='h-full w-full rounded-2xl bg-gradient-to-r from-transparent via-white/5 to-transparent bg-[length:200%_100%] animate-[shimmer_1.4s_infinite]' />
    </div>
  )
}

function Dashboard({ onPlayClick, onPuzzlesClick }) {
  const [loading, setLoading] = useState(true)
  const [ratingsLoading, setRatingsLoading] = useState(true)
  const [ratingsError, setRatingsError] = useState('')
  const [ratingsByType, setRatingsByType] = useState(() =>
    Object.fromEntries(RATING_TYPES.map(({ key }) => [key, []]))
  )
  const [ratingsUpdatedAtByType, setRatingsUpdatedAtByType] = useState(() =>
    Object.fromEntries(RATING_TYPES.map(({ key }) => [key, '']))
  )
  const [activeRatingsType, setActiveRatingsType] = useState('classical')

  const formatPlayerName = (name) => {
    const raw = String(name || '').trim()
    if (!raw.includes(',')) return raw
    const parts = raw.split(',').map((part) => part.trim()).filter(Boolean)
    if (parts.length < 2) return raw.replace(',', '')
    const [lastName, ...rest] = parts
    return `${rest.join(' ')} ${lastName}`.replace(/\s+/g, ' ').trim()
  }

  const formatDelta = (value) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return '-'
    return `${numeric > 0 ? '+' : ''}${numeric.toFixed(1)}`
  }

  const getDeltaClass = (value) => {
    const numeric = Number(value)
    if (numeric > 0) return 'text-emerald-300'
    if (numeric < 0) return 'text-red-300'
    return 'text-slate-400'
  }

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 900)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    let active = true

    const loadRatings = async () => {
      try {
        const responses = await Promise.all(
          RATING_TYPES.map(({ key }) => fetchLiveFideRatings(30, key))
        )

        if (!active) return

        const nextRatingsByType = {}
        const nextUpdatedAtByType = {}

        responses.forEach((data, index) => {
          const typeKey = RATING_TYPES[index].key
          nextRatingsByType[typeKey] = data?.ratings || []
          nextUpdatedAtByType[typeKey] = data?.updatedAtText || data?.fetchedAt || ''
        })

        setRatingsByType(nextRatingsByType)
        setRatingsUpdatedAtByType(nextUpdatedAtByType)
        setRatingsError('')
      } catch (error) {
        if (!active) return
        setRatingsError(error?.message || 'Failed to load live ratings')
      } finally {
        if (active) setRatingsLoading(false)
      }
    }

    loadRatings()
    const id = setInterval(loadRatings, 30000)

    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  if (loading) {
    return (
      <div className='grid grid-cols-1 gap-4 xl:grid-cols-12'>
        <div className='xl:col-span-8 space-y-4'>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className='xl:col-span-4 space-y-4'>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  const activeRatingLabel =
    RATING_TYPES.find((type) => type.key === activeRatingsType)?.label || 'Classical'
  const activeRatings = ratingsByType[activeRatingsType] || []
  const activeUpdatedAt = ratingsUpdatedAtByType[activeRatingsType] || '-'

  return (
    <div className='grid grid-cols-1 gap-4 xl:grid-cols-12'>
      <div className='space-y-4 xl:col-span-8'>
        <section className='grid grid-cols-2 gap-3 md:grid-cols-4'>
          <div className='rounded-2xl border border-white/10 bg-[#252526]/85 p-4'>
            <p className='text-xs uppercase tracking-[0.12em] text-slate-400'>Rating</p>
            <p className='mt-1 text-2xl font-bold text-white'>1712</p>
          </div>
          <div className='rounded-2xl border border-white/10 bg-[#252526]/85 p-4'>
            <p className='text-xs uppercase tracking-[0.12em] text-slate-400'>Win Rate</p>
            <p className='mt-1 text-2xl font-bold text-emerald-300'>58%</p>
          </div>
          <div className='rounded-2xl border border-white/10 bg-[#252526]/85 p-4'>
            <p className='text-xs uppercase tracking-[0.12em] text-slate-400'>Streak</p>
            <p className='mt-1 text-2xl font-bold text-amber-300'>+4</p>
          </div>
          <div className='rounded-2xl border border-white/10 bg-[#252526]/85 p-4'>
            <p className='text-xs uppercase tracking-[0.12em] text-slate-400'>Puzzles</p>
            <p className='mt-1 text-2xl font-bold text-cyan-300'>124</p>
          </div>
        </section>

        <PlayCard
          onPlayOnline={onPlayClick}
          onPlayComputer={() => console.log('Play vs computer clicked')}
        />

        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          <GameList title='Current Games' items={currentGames} actionLabel='Resume' />
          <PuzzleCard onOpenPuzzles={onPuzzlesClick} />
        </div>

        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          <GameList title='Recent Games' items={recentGames} actionLabel='Review' />
          <GameList title='Tournaments' items={tournaments} actionLabel='Join' />
        </div>
      </div>

      <aside className='space-y-4 xl:col-span-4'>
        <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-5 backdrop-blur'>
          <div className='mb-3 flex items-center justify-between'>
            <h3 className='text-lg font-semibold text-white'>Live FIDE Ratings Top 30</h3>
            <span className='rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300'>Live</span>
          </div>

          <div className='mb-3 flex flex-wrap gap-2'>
            {RATING_TYPES.map((type) => (
              <button
                key={type.key}
                type='button'
                onClick={() => setActiveRatingsType(type.key)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  activeRatingsType === type.key
                    ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40'
                    : 'bg-[#2d2d30] text-slate-300 hover:bg-[#35353a]'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          <p className='mb-3 text-xs text-slate-400'>
            {activeRatingLabel} updated: <span className='text-slate-200'>{activeUpdatedAt}</span>
          </p>

          <p className='mb-3 text-xs text-slate-400'>
            Showing <span className='text-slate-200'>{activeRatings.length}</span> of up to 30 players.
          </p>

          {ratingsLoading && <p className='text-sm text-slate-400'>Loading live ratings...</p>}
          {!ratingsLoading && ratingsError && <p className='text-sm text-red-300'>{ratingsError}</p>}

          {!ratingsLoading && !ratingsError && !activeRatings.length && (
            <p className='text-sm text-slate-400'>No live ratings available right now.</p>
          )}

          {!ratingsLoading && !ratingsError && (
            <div className='max-h-[34rem] space-y-2 overflow-auto pr-1'>
              {activeRatings.map((player) => (
                <div key={`${activeRatingsType}-${player.rank}-${player.name}`} className='grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-lg bg-[#2d2d30] px-3 py-2'>
                  <span className='text-xs font-semibold text-slate-400'>#{player.rank}</span>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-semibold text-slate-100'>{formatPlayerName(player.name)}</p>
                    <p className='text-[11px] text-slate-400'>{player.federation || '-'}</p>
                  </div>
                  <div className='text-right'>
                    <p className='text-sm font-bold text-white'>
                      {Number.isFinite(Number(player.rating)) ? Number(player.rating).toFixed(1) : '-'}
                    </p>
                    <p className={`text-[11px] ${getDeltaClass(player.change)}`}>
                      {formatDelta(player.change)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-5 backdrop-blur'>
          <h3 className='mb-4 text-lg font-semibold text-white'>Friends Online</h3>
          <div className='space-y-2'>
            {friends.map((friend) => (
              <div key={friend.id} className='flex items-center justify-between rounded-lg bg-[#2d2d30] px-3 py-2'>
                <div className='flex items-center gap-2'>
                  <span className='h-2 w-2 rounded-full bg-emerald-400' />
                  <span className='text-sm text-slate-200'>{friend.name}</span>
                </div>
                <span className='text-xs text-slate-400'>{friend.rating}</span>
              </div>
            ))}
          </div>
        </section>

        <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-5 backdrop-blur'>
          <h3 className='mb-3 text-lg font-semibold text-white'>Chat</h3>
          <div className='space-y-2 text-sm text-slate-300'>
            <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>Nadia: Ready for blitz?</p>
            <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>You: In 5 mins.</p>
          </div>
        </section>

        <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-5 backdrop-blur'>
          <h3 className='mb-3 text-lg font-semibold text-white'>Leaderboard</h3>
          <ol className='space-y-2 text-sm text-slate-200'>
            <li className='flex justify-between rounded-lg bg-[#2d2d30] px-3 py-2'><span>1. Magnus97</span><span>2890</span></li>
            <li className='flex justify-between rounded-lg bg-[#2d2d30] px-3 py-2'><span>2. HikaruX</span><span>2844</span></li>
            <li className='flex justify-between rounded-lg bg-[#2d2d30] px-3 py-2'><span>3. AlirezaA</span><span>2812</span></li>
          </ol>
        </section>
      </aside>
    </div>
  )
}

export default Dashboard
