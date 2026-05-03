import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import {
  fetchFideGameDetail,
  fetchFidePlayerDetails,
  fetchFidePlayerGames,
  fetchLiveFideRatings
} from '../utils/lichessApi'
import { useAppStore } from '../store/useAppStore'
import { usePlayStore } from '../store/usePlayStore'

const quickPairings = [
  { id: '1+0', label: 'Bullet', players: '8.1k' },
  { id: '2+1', label: 'Bullet', players: '6.4k' },
  { id: '3+2', label: 'Blitz', players: '14.8k' },
  { id: '10+0', label: 'Rapid', players: '4.9k' },
  { id: '15+10', label: 'Rapid', players: '2.3k' },
  { id: '30+20', label: 'Classical', players: '0.8k' }
]

const spotlightEvents = [
  { title: 'Weekend Arena', subtitle: 'Open tournament • Starts in 14m', action: 'Join' },
  { title: 'FIDE Broadcast Hub', subtitle: 'Live boards and commentary', action: 'Watch' },
  { title: 'Swiss Team Battle', subtitle: 'Round 4/9 • 312 players', action: 'Open' }
]

const timeline = [
  { id: 't1', text: 'You gained +12 in Blitz after a 4-game streak.', time: '5 min ago' },
  { id: 't2', text: 'New opening insight: Sicilian Defense accuracy 74%.', time: '18 min ago' },
  { id: 't3', text: 'Friend Nadia started a rapid game.', time: '31 min ago' }
]

const chessStyleSections = [
  {
    id: 'play',
    title: 'Play Online',
    subtitle: 'Rated games and live challenges against players worldwide.',
    cta: 'Play now',
    colorClass: 'text-[#4ade80]',
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="14" rx="2" ry="2"></rect>
        <path d="M8 21h8"></path>
        <path d="M12 17v4"></path>
        <path d="m8 10 2-2 2 2 4-4"></path>
      </svg>
    )
  },
  {
    id: 'puzzles',
    title: 'Solve Puzzles',
    subtitle: 'Practice tactical shots without rating stakes.',
    cta: 'Solve now',
    colorClass: 'text-[#60a5fa]',
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
        <line x1="9" y1="9" x2="9.01" y2="9"></line>
        <line x1="15" y1="9" x2="15.01" y2="9"></line>
      </svg>
    )
  },
  {
    id: 'learn',
    title: 'Learn & Study',
    subtitle: 'Train openings, endgames, and strategy modules.',
    cta: 'Start learning',
    colorClass: 'text-[#c084fc]',
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    )
  },
  {
    id: 'watch',
    title: 'Watch Events',
    subtitle: 'Follow top arena-style Swiss pairings and streams.',
    cta: 'Watch now',
    colorClass: 'text-[#fbbf24]',
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
        <path d="M4 22h16"></path>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
      </svg>
    )
  },
  {
    id: 'review',
    title: 'Game Review',
    subtitle: 'Analyze mistakes and find engine improvements.',
    cta: 'Review now',
    colorClass: 'text-[#2dd4bf]',
    icon: (
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.3-4.3"></path>
        <path d="m8 11 2-2 2 2 4-4"></path>
      </svg>
    )
  }
]

const RATING_TYPES = [
  { key: 'classical', label: 'Classical' },
  { key: 'rapid', label: 'Rapid' },
  { key: 'blitz', label: 'Blitz' }
]

function HomeSection({ onPlayClick, onPuzzlesClick, onWatchClick, onLearnClick }) {
  const totalPlayers = useMemo(
    () => quickPairings.reduce((sum, row) => sum + Number(row.players.replace('k', '')), 0).toFixed(1),
    []
  )
  const [ratingsLoading, setRatingsLoading] = useState(true)
  const [ratingsError, setRatingsError] = useState('')
  const [ratingsByType, setRatingsByType] = useState(() =>
    Object.fromEntries(RATING_TYPES.map(({ key }) => [key, []]))
  )
  const [ratingsUpdatedAtByType, setRatingsUpdatedAtByType] = useState(() =>
    Object.fromEntries(RATING_TYPES.map(({ key }) => [key, '']))
  )
  const [activeRatingsType, setActiveRatingsType] = useState('classical')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [playerDetails, setPlayerDetails] = useState(null)
  const [playerDetailsLoading, setPlayerDetailsLoading] = useState(false)
  const [playerDetailsError, setPlayerDetailsError] = useState('')
  const [playerImageFailed, setPlayerImageFailed] = useState(false)
  const [playerGames, setPlayerGames] = useState([])
  const [playerGamesPage, setPlayerGamesPage] = useState(1)
  const [playerGamesLoading, setPlayerGamesLoading] = useState(false)
  const [playerGamesError, setPlayerGamesError] = useState('')
  const [playerGamesHasMore, setPlayerGamesHasMore] = useState(false)
  const [analyzingGamePath, setAnalyzingGamePath] = useState('')

  const setActivePage = useAppStore((s) => s.setActivePage)
  const loadGameForReview = usePlayStore((s) => s.loadGameForReview)
  const openReview = () => setActivePage('news')

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

  const toParagraphs = (value) =>
    String(value || '')
      .split(/\n\s*\n/g)
      .map((part) => part.replace(/\n+/g, ' ').trim())
      .filter(Boolean)

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

  const activeRatingLabel =
    RATING_TYPES.find((type) => type.key === activeRatingsType)?.label || 'Classical'
  const activeRatings = ratingsByType[activeRatingsType] || []
  const activeUpdatedAt = ratingsUpdatedAtByType[activeRatingsType] || '-'
  const selectedRatings = selectedPlayer ? (playerDetails?.ratings || null) : null

  const closePlayerDetails = () => {
    setSelectedPlayer(null)
    setPlayerDetails(null)
    setPlayerDetailsError('')
    setPlayerDetailsLoading(false)
    setPlayerImageFailed(false)
    setPlayerGames([])
    setPlayerGamesPage(1)
    setPlayerGamesLoading(false)
    setPlayerGamesError('')
    setPlayerGamesHasMore(false)
    setAnalyzingGamePath('')
  }

  const loadPlayerGames = async (slug, page = 1) => {
    setPlayerGamesLoading(true)
    setPlayerGamesError('')
    try {
      const data = await fetchFidePlayerGames(slug, { page, limit: 30 })
      const incomingGames = Array.isArray(data?.games) ? data.games : []
      setPlayerGames((prev) => (page === 1 ? incomingGames : [...prev, ...incomingGames]))
      setPlayerGamesHasMore(Boolean(data?.hasMore))
      setPlayerGamesPage(page)
    } catch (error) {
      setPlayerGamesError(error?.message || 'Failed to load player games')
    } finally {
      setPlayerGamesLoading(false)
    }
  }

  const buildReviewMovesFromPgn = (pgn) => {
    const game = new Chess()
    game.loadPgn(String(pgn || ''), { strict: false })
    const history = game.history({ verbose: true })
    return history.map((move) => ({
      from: move.from,
      to: move.to,
      san: move.san,
      color: move.color,
      promotion: move.promotion || undefined,
      captured: move.captured || undefined
    }))
  }

  const analyzePlayerGame = async (gameItem) => {
    const gamePath = gameItem?.gamePath || gameItem?.gameUrl || ''
    if (!gamePath) return

    setAnalyzingGamePath(gamePath)
    try {
      const detail = await fetchFideGameDetail(gamePath)
      const pgn = String(detail?.pgn || '').trim()
      if (!pgn) {
        throw new Error('PGN not available for this game')
      }

      const moves = buildReviewMovesFromPgn(pgn)
      if (!moves.length) {
        throw new Error('Could not parse game moves for review')
      }

      loadGameForReview({
        initialFen: new Chess().fen(),
        fen: new Chess().fen(),
        moves
      })
      closePlayerDetails()
      setActivePage('news')
    } catch (error) {
      setPlayerGamesError(error?.message || 'Failed to analyze selected game')
    } finally {
      setAnalyzingGamePath('')
    }
  }

  const openPlayerDetails = async (player) => {
    if (!player?.playerSlug) return

    setSelectedPlayer(player)
    setPlayerDetails(null)
    setPlayerDetailsError('')
    setPlayerDetailsLoading(true)
    setPlayerImageFailed(false)

    try {
      const data = await fetchFidePlayerDetails(player.playerSlug)
      setPlayerDetails(data)
      await loadPlayerGames(player.playerSlug, 1)
    } catch (error) {
      setPlayerDetailsError(error?.message || 'Failed to load player details')
    } finally {
      setPlayerDetailsLoading(false)
    }
  }

  return (
    <>
      <div className='chess-page grid grid-cols-1 gap-4 xl:grid-cols-12'>
        <section className='space-y-4 xl:col-span-8'>
        <div className='chess-hero relative overflow-hidden'>
          <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_90%_at_0%_0%,rgba(52,211,153,0.18),transparent_55%)]' />
          <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_60%_at_100%_100%,rgba(56,189,248,0.12),transparent_60%)]' />
          <div className='relative p-6 md:p-8'>
            <p className='text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-1'>Home</p>
            <h1 className='text-3xl font-extrabold tracking-tight text-white md:text-4xl'>Chess Dashboard</h1>
            <p className='mt-2 max-w-2xl text-sm text-slate-400'>Quick play, puzzle training, guided learning, live watch, and full game review — all in one place.</p>
            <div className='mt-5 flex flex-wrap items-center gap-3'>
              <button onClick={onPlayClick} className='chess-btn-primary'>▶ Play Game</button>
              <button onClick={onPuzzlesClick} className='chess-btn-secondary'>⚡ Solve Puzzle</button>
              <button onClick={openReview} className='chess-btn-secondary'>🔍 Analyze Game</button>
              <span className='flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 ml-1'>
                <span className='h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse' />~37.3k online
              </span>
            </div>
          </div>
        </div>

          <div className='chess-card'>
            <div className='mb-5 flex items-center justify-between'>
              <h2 className='font-serif text-xl font-bold text-white'>Core Sections</h2>
              <span className='text-[11px] text-slate-400'>Play · Puzzle · Learn · Watch · Review</span>
            </div>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              {chessStyleSections.map((section) => {
                const handler = section.id === 'play' ? onPlayClick : section.id === 'puzzles' ? onPuzzlesClick : section.id === 'learn' ? onLearnClick : section.id === 'watch' ? onWatchClick : openReview
                return (
                  <button key={section.id} onClick={handler}
                    className='group flex h-full flex-col items-start rounded-2xl border border-white/[0.04] bg-[#1e1e1e] p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-white/10 hover:bg-[#252526] hover:shadow-2xl'>
                    <div className={`mb-4 ${section.colorClass} transition-transform duration-300 group-hover:scale-110`}>
                      {section.icon}
                    </div>
                    <div className='flex-1'>
                      <h3 className='mb-1 font-serif text-lg font-bold text-white'>{section.title}</h3>
                      <p className='text-[13px] leading-relaxed text-slate-400'>{section.subtitle}</p>
                    </div>
                    <div className={`mt-6 flex items-center text-sm font-bold ${section.colorClass}`}>
                      {section.cta} <span className='ml-1.5 text-lg leading-none transition-transform group-hover:translate-x-1'>›</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

        <div className='chess-card'>
          <div className='mb-5 flex items-center justify-between'>
            <h2 className='text-lg font-bold text-white'>Quick Pairing Pools</h2>
            <span className='flex items-center gap-1.5 text-[11px] text-slate-400'>
              <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-[#6ea13c]' />~{totalPlayers}k online
            </span>
          </div>
          <div className='grid grid-cols-2 gap-3 md:grid-cols-3'>
            {quickPairings.map((pool) => (
              <button key={pool.id} onClick={onPlayClick}
                className='card-compact group text-left transition hover:-translate-y-1 hover:border-[rgba(110,161,60,0.5)]'>
                <p className='text-sm font-bold text-white transition-colors group-hover:text-[#6ea13c]'>{pool.id}</p>
                <p className='mt-1 text-[11px] text-slate-400'>{pool.label} · {pool.players}</p>
              </button>
            ))}
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          <div className='chess-card'>
            <h3 className='mb-4 text-base font-bold text-white'>Featured Events</h3>
            <div className='space-y-3'>
              {spotlightEvents.map((event) => (
                <div key={event.title} className='card-compact flex items-center justify-between transition hover:border-[rgba(255,255,255,0.1)]'>
                  <div>
                    <p className='text-sm font-semibold text-slate-100'>{event.title}</p>
                    <p className='mt-1 text-[11px] text-slate-400'>{event.subtitle}</p>
                  </div>
                  <button onClick={onWatchClick}
                    className='rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[rgba(255,255,255,0.08)]'>
                    {event.action}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className='chess-card'>
            <h3 className='mb-4 text-base font-bold text-white'>Timeline</h3>
            <div className='space-y-3'>
              {timeline.map((entry) => (
                <div key={entry.id} className='card-compact flex items-start gap-3'>
                  <div className='mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f3c24b]' />
                  <div className='flex-1'>
                    <p className='text-sm text-slate-200'>{entry.text}</p>
                    <span className='badge-pill mt-1 inline-block px-2 py-0.5 text-[10px] text-slate-400'>{entry.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </section>

        <aside className='space-y-4 xl:col-span-4'>
          <section className='hero-accent p-5'>
          <div className='mb-4 flex items-center justify-between'>
            <h3 className='text-lg font-bold text-white'>Live FIDE Ratings</h3>
            <span className='rounded bg-[#6ea13c]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6ea13c]'>Live</span>
          </div>

          <div className='mb-4 flex flex-wrap gap-2'>
            {RATING_TYPES.map((type) => (
              <button
                key={type.key}
                type='button'
                onClick={() => setActiveRatingsType(type.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeRatingsType === type.key
                    ? 'bg-[#f3c24b] text-[#0f1113] shadow-[0_0_15px_rgba(243,194,75,0.3)]'
                    : 'bg-[rgba(255,255,255,0.04)] text-slate-300 hover:bg-[rgba(255,255,255,0.08)]'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          <p className='mb-1 text-xs text-slate-400'>
            {activeRatingLabel} updated: <span className='text-slate-200'>{activeUpdatedAt}</span>
          </p>
          <p className='mb-4 text-xs text-slate-400'>
            Showing <span className='text-slate-200'>{activeRatings.length}</span> of top 30 players.
          </p>

          {ratingsLoading && <p className='text-sm text-[#f3c24b]'>Loading live ratings...</p>}
          {!ratingsLoading && ratingsError && <p className='text-sm text-red-400'>{ratingsError}</p>}
          {!ratingsLoading && !ratingsError && !activeRatings.length && (
            <p className='mt-4 text-sm text-slate-400'>No live ratings available right now.</p>
          )}

          {!ratingsLoading && !ratingsError && (
            <div className='mt-4 max-h-[28rem] space-y-2 overflow-auto pr-2'>
              {activeRatings.map((player) => (
                <div key={`${activeRatingsType}-${player.rank}-${player.name}`} className='card-compact group flex items-center gap-3 transition hover:-translate-y-0.5 hover:border-[rgba(243,194,75,0.4)]'>
                  <span className='w-5 text-center text-[10px] font-bold text-slate-500 group-hover:text-[#f3c24b]'>#{player.rank}</span>
                  <div className='min-w-0 flex-1'>
                    <button
                      type='button'
                      onClick={() => openPlayerDetails(player)}
                      className='flex items-center gap-2 truncate text-left text-sm font-bold text-slate-100 transition-colors group-hover:text-[#f3c24b]'
                      title={player.playerSlug ? 'Show player details' : 'Player profile unavailable'}
                    >
                      {formatPlayerName(player.name)}
                      {player.isLive && (
                        <span className='relative flex h-1.5 w-1.5 shrink-0' title={player.liveUrl || 'Live'}>
                          <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6ea13c] opacity-75'></span>
                          <span className='relative inline-flex h-1.5 w-1.5 rounded-full bg-[#6ea13c]'></span>
                        </span>
                      )}
                    </button>
                    <p className='mt-0.5 text-[10px] uppercase tracking-widest text-slate-500'>{player.federation || '-'}</p>
                  </div>
                  <div className='text-right'>
                    <p className='text-sm font-black text-white'>
                      {Number.isFinite(Number(player.rating)) ? Number(player.rating).toFixed(1) : '-'}
                    </p>
                    <p className={`text-[10px] font-bold ${getDeltaClass(player.change)}`}>
                      {formatDelta(player.change)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          </section>

          <section className='hero-accent p-5'>
            <h3 className='mb-4 text-base font-bold text-white'>Daily Puzzle</h3>
            <div className='relative overflow-hidden rounded-xl border border-[rgba(243,194,75,0.2)] bg-[rgba(28,28,30,0.4)] p-4'>
              <div className='pointer-events-none absolute -right-4 -top-4 text-[#f3c24b] opacity-10'>
                <svg className='h-24 w-24' viewBox='0 0 24 24' fill='currentColor'><path d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z'/></svg>
              </div>
              <p className='relative text-sm font-bold text-white'>White to move</p>
              <p className='relative mb-4 mt-1 text-[11px] text-slate-400'>Win material in 3 moves.</p>
              <button
                onClick={onPuzzlesClick}
                className='chess-btn-primary relative w-full shadow-lg shadow-[#f3c24b]/20 hover:-translate-y-1'
              >
                Solve Now
              </button>
            </div>
          </section>

          <section className='chess-card'>
            <h3 className='mb-4 text-base font-bold text-white'>Openings To Train</h3>
            <ul className='space-y-2'>
              {['Sicilian Defense: Najdorf', 'Queen\'s Gambit Declined', 'Ruy Lopez: Berlin Endgame'].map((opening) => (
                <li key={opening} className='card-compact group flex cursor-pointer items-center justify-between px-4 py-3 transition hover:border-[#6ea13c]/30 hover:bg-[rgba(110,161,60,0.05)]'>
                  <span className='text-xs font-bold text-slate-300 transition-colors group-hover:text-[#6ea13c]'>{opening}</span>
                  <span className='text-[#6ea13c]/50 group-hover:text-[#6ea13c]'>→</span>
                </li>
              ))}
            </ul>
          </section>

          <section className='chess-card'>
            <h3 className='mb-3 text-base font-bold text-white'>Community</h3>
            <p className='mb-4 text-xs text-slate-400'>Forums, teams, and study groups are active now. Join the conversation.</p>
            <button
              onClick={onWatchClick}
              className='chess-btn-secondary w-full hover:-translate-y-1'
            >
              Open Live Watch
            </button>
          </section>
        </aside>
      </div>

      {selectedPlayer && (
        <div className='fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0b0b0c]/90 px-4 py-8 backdrop-blur-md'>
          <div className='chess-hero relative w-full max-w-5xl overflow-hidden shadow-2xl'>
            <div className='relative overflow-hidden border-b border-[rgba(255,255,255,0.06)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)] px-6 py-6'>
              <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_100%_at_0%_0%,rgba(243,194,75,0.12),transparent_50%)]' />
              <div className='relative flex items-start justify-between gap-4'>
                <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
                  <div className='shrink-0'>
                    {playerDetails?.photoUrl && !playerImageFailed ? (
                      <div className='card-compact relative overflow-hidden p-1 shadow-lg'>
                        <img
                          src={playerDetails.photoUrl}
                          alt={playerDetails.name || 'Player'}
                          className='h-24 w-24 rounded-xl object-cover sm:h-28 sm:w-28'
                          onError={() => setPlayerImageFailed(true)}
                        />
                      </div>
                    ) : (
                      <div className='card-compact flex h-24 w-24 items-center justify-center bg-gradient-to-br from-[rgba(255,255,255,0.05)] to-transparent shadow-lg sm:h-28 sm:w-28'>
                        <span className='text-3xl font-black text-slate-600 sm:text-4xl'>
                          {String(playerDetails?.name || selectedPlayer.name || '?')
                            .split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || '?'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className='min-w-0'>
                    <p className='mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#f3c24b]'>Player Profile</p>
                    <h3 className='truncate text-2xl font-extrabold text-white sm:text-3xl'>
                      {playerDetails?.name || formatPlayerName(selectedPlayer.name)}
                    </h3>
                    <p className='mt-1 text-sm text-slate-400'>{playerDetails?.country || selectedPlayer.federation || '-'}</p>

                    <div className='mt-4 grid grid-cols-3 gap-2 sm:max-w-xl'>
                      {[
                        { label: 'Bullet', value: selectedRatings?.bullet ?? playerDetails?.liveRating ?? '-' },
                        { label: 'Blitz', value: selectedRatings?.blitz ?? playerDetails?.blitz?.rating ?? playerDetails?.fideRating ?? '-' },
                        { label: 'Rapid', value: selectedRatings?.rapid ?? playerDetails?.rapid?.rating ?? playerDetails?.fideRating ?? '-' }
                      ].map((item) => (
                        <div key={item.label} className='rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center'>
                          <p className='text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500'>{item.label}</p>
                          <p className='mt-1 text-lg font-black text-white'>{item.value ?? '-'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type='button'
                  onClick={closePlayerDetails}
                  className='rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-2 text-slate-400 transition hover:bg-[rgba(255,255,255,0.08)] hover:text-white'
                >
                  <svg xmlns='http://www.w3.org/2000/svg' className='h-5 w-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12'/></svg>
                </button>
              </div>
            </div>

            <div className='max-h-[75vh] overflow-y-auto p-6'>
              {playerDetailsLoading && <p className='text-sm text-[#f3c24b]'>Loading player details...</p>}
              {!playerDetailsLoading && playerDetailsError && <p className='rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300'>{playerDetailsError}</p>}

              {!playerDetailsLoading && !playerDetailsError && playerDetails && (
                <div className='space-y-6'>
                  <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                    <div className='card-compact px-4 py-3'>
                      <p className='mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500'>Country</p>
                      <p className='truncate text-lg font-black text-white'>{playerDetails.country || '-'}</p>
                    </div>
                    <div className='card-compact px-4 py-3'>
                      <p className='mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500'>Age</p>
                      <p className='text-lg font-black text-white'>{playerDetails.age || '-'}</p>
                    </div>
                    <div className='card-compact px-4 py-3'>
                      <p className='mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500'>Born</p>
                      <p className='text-lg font-black text-white'>{playerDetails.born || '-'}</p>
                    </div>
                    <div className='card-compact px-4 py-3'>
                      <p className='mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500'>FIDE ID</p>
                      <p className='truncate text-lg font-black text-white'>{playerDetails.fideId || '-'}</p>
                    </div>
                  </div>

                  <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                    <div className='card-compact px-4 py-3 text-center'><p className='text-2xl font-black text-white'>{playerDetails.totalGames ?? '-'}</p><p className='mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500'>Games</p></div>
                    <div className='card-compact px-4 py-3 text-center'><p className='text-2xl font-black text-[#6ea13c]'>{playerDetails.wins ?? '-'}</p><p className='mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500'>Wins</p></div>
                    <div className='card-compact px-4 py-3 text-center'><p className='text-2xl font-black text-red-400'>{playerDetails.losses ?? '-'}</p><p className='mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500'>Losses</p></div>
                    <div className='card-compact px-4 py-3 text-center'><p className='text-2xl font-black text-slate-400'>{playerDetails.draws ?? '-'}</p><p className='mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500'>Draws</p></div>
                  </div>

                  <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                    <div className='card-compact p-4'>
                      <p className='mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500'>Top Openings (White)</p>
                      <div className='space-y-2'>
                        {(playerDetails.openings?.white || []).map((line) => (
                          <div key={`white-${line}`} className='badge-pill px-3 py-2 text-sm font-medium text-slate-200'>{line}</div>
                        ))}
                        {!playerDetails.openings?.white?.length && <p className='text-sm text-slate-500'>No opening data</p>}
                      </div>
                    </div>
                    <div className='card-compact p-4'>
                      <p className='mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500'>Top Openings (Black)</p>
                      <div className='space-y-2'>
                        {(playerDetails.openings?.black || []).map((line) => (
                          <div key={`black-${line}`} className='badge-pill px-3 py-2 text-sm font-medium text-slate-200'>{line}</div>
                        ))}
                        {!playerDetails.openings?.black?.length && <p className='text-sm text-slate-500'>No opening data</p>}
                      </div>
                    </div>
                  </div>

                  <div className='card-compact p-4'>
                    <p className='mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500'>Rating History</p>
                    <div className='max-h-48 overflow-auto'>
                      <table className='w-full text-left text-sm'>
                        <thead className='sticky top-0 bg-[rgba(255,255,255,0.02)] text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur-md'>
                          <tr>
                            <th className='pb-2 pl-2'>Date</th>
                            <th className='pr-2 text-right pb-2'>Rating</th>
                          </tr>
                        </thead>
                        <tbody className='divide-y divide-[rgba(255,255,255,0.04)]'>
                          {(playerDetails.ratingHistory || []).map((entry) => (
                            <tr key={`${entry.date}-${entry.rating}`} className='hover:bg-[rgba(255,255,255,0.02)]'>
                              <td className='pl-2 py-2 text-slate-300'>{entry.date}</td>
                              <td className='pr-2 py-2 text-right font-black text-[#f3c24b]'>{entry.rating}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!playerDetails.ratingHistory?.length && <p className='text-sm text-slate-500'>No history available</p>}
                    </div>
                  </div>

                  <div className='card-compact p-4'>
                    <div className='mb-4 flex items-center justify-between'>
                      <p className='text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500'>Player Games</p>
                      <span className='badge-pill text-[10px] font-semibold text-slate-400'>Page {playerGamesPage}</span>
                    </div>
                    {playerGamesLoading && !playerGames.length && <p className='text-sm text-slate-400'>Loading games...</p>}
                    {playerGamesError && <p className='mb-3 text-sm text-red-400'>{playerGamesError}</p>}
                    {!playerGamesLoading && !playerGames.length && !playerGamesError && <p className='text-sm text-slate-500'>No games found for this player.</p>}

                    {!!playerGames.length && (
                      <div className='max-h-64 overflow-auto rounded-lg border border-[rgba(255,255,255,0.04)] bg-[rgba(0,0,0,0.2)]'>
                        <table className='w-full text-left'>
                          <thead className='sticky top-0 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(28,28,30,0.9)] text-[10px] font-bold uppercase tracking-widest text-slate-500 shadow-sm backdrop-blur-md'>
                            <tr>
                              <th className='p-3'>Pairing</th>
                              <th className='p-3'>Result</th>
                              <th className='p-3 text-right'>Action</th>
                            </tr>
                          </thead>
                          <tbody className='divide-y divide-[rgba(255,255,255,0.04)]'>
                            {playerGames.map((game) => (
                              <tr key={`${game.gamePath}-${game.index}`} className='transition hover:bg-[rgba(255,255,255,0.02)]'>
                                <td className='p-3'>
                                  <p className='text-sm font-semibold text-white'>{game.white} <span className='font-normal text-slate-500'>vs</span> {game.black}</p>
                                  <p className='mt-1 text-[10px] text-slate-400'>{game.date || '-'} • {game.site || '-'} • {game.moves ?? '-'} moves</p>
                                </td>
                                <td className='p-3 text-sm font-bold text-slate-300'>{game.result || '-'}</td>
                                <td className='p-3 text-right'>
                                  <button
                                    type='button'
                                    onClick={() => analyzePlayerGame(game)}
                                    disabled={analyzingGamePath === game.gamePath}
                                    className='rounded-lg border border-[#f3c24b]/30 bg-[#f3c24b]/10 px-3 py-1.5 text-[11px] font-bold text-[#f3c24b] transition hover:bg-[#f3c24b]/20 disabled:opacity-50'
                                  >
                                    {analyzingGamePath === game.gamePath ? 'Loading...' : 'Analyze'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className='mt-4 flex justify-end'>
                      <button
                        type='button'
                        onClick={() => selectedPlayer?.playerSlug && loadPlayerGames(selectedPlayer.playerSlug, playerGamesPage + 1)}
                        disabled={!playerGamesHasMore || playerGamesLoading}
                        className='chess-btn-secondary text-[11px] font-bold text-slate-300 hover:text-white disabled:opacity-50'
                      >
                        {playerGamesLoading ? 'Loading...' : playerGamesHasMore ? 'Load More Games' : 'End of History'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default HomeSection
