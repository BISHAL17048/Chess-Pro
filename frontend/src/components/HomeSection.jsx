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
    title: 'Play',
    subtitle: 'Jump into live matches and challenges.',
    cta: 'Play Now',
    accent: 'from-emerald-500/30 to-lime-400/10',
    badge: 'Live'
  },
  {
    id: 'puzzles',
    title: 'Puzzles',
    subtitle: 'Solve tactical shots and improve accuracy.',
    cta: 'Solve Puzzles',
    accent: 'from-amber-500/30 to-orange-400/10',
    badge: 'Daily'
  },
  {
    id: 'learn',
    title: 'Learn',
    subtitle: 'Train openings, endgames, and strategy.',
    cta: 'Start Learning',
    accent: 'from-cyan-500/30 to-sky-400/10',
    badge: 'Courses'
  },
  {
    id: 'watch',
    title: 'Watch',
    subtitle: 'Follow top games, events, and streams.',
    cta: 'Watch Games',
    accent: 'from-rose-500/30 to-pink-400/10',
    badge: 'Broadcast'
  },
  {
    id: 'review',
    title: 'Game Review',
    subtitle: 'Analyze mistakes and find improvements.',
    cta: 'Open Review',
    accent: 'from-violet-500/30 to-indigo-400/10',
    badge: 'Engine'
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
        <div className='chess-hero'>
          <div className='bg-[radial-gradient(circle_at_0%_0%,rgba(134,239,172,0.23),transparent_45%),radial-gradient(circle_at_95%_5%,rgba(56,189,248,0.2),transparent_45%)] p-5 md:p-6'>
            <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300'>Home</p>
            <h1 className='mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl'>Chess Dashboard</h1>
            <p className='mt-2 max-w-2xl text-sm text-slate-300'>
              Everything in one place, like Chess.com: quick play, puzzle training, guided learning, live watch, and full game review.
            </p>
            <div className='mt-4 flex flex-wrap gap-2'>
              <button
                onClick={onPlayClick}
                className='chess-btn-primary'
              >
                Play Game
              </button>
              <button
                onClick={onPuzzlesClick}
                className='chess-btn-secondary hover:border-amber-300/60 hover:bg-amber-400/10'
              >
                Solve Puzzle
              </button>
              <button
                onClick={openReview}
                className='chess-btn-secondary hover:border-violet-300/60 hover:bg-violet-400/10'
              >
                Analyze Game
              </button>
            </div>
          </div>
        </div>

        <div className='chess-card'>
          <div className='mb-3 flex items-center justify-between'>
            <h2 className='text-lg font-semibold text-white'>Core Sections</h2>
            <span className='text-xs text-slate-400'>Play • Puzzle • Learn • Watch • Review</span>
          </div>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'>
            {chessStyleSections.map((section) => {
              const handler = section.id === 'play'
                ? onPlayClick
                : section.id === 'puzzles'
                  ? onPuzzlesClick
                  : section.id === 'learn'
                    ? onLearnClick
                    : section.id === 'watch'
                      ? onWatchClick
                      : openReview

              return (
                <button
                  key={section.id}
                  onClick={handler}
                  className='group rounded-xl border border-white/10 bg-[#2d2d30] p-4 text-left transition hover:border-cyan-300/60 hover:bg-[#343439]'
                >
                  <div className={`mb-2 rounded-md bg-gradient-to-r p-[1px] ${section.accent}`}>
                    <div className='rounded-md bg-[#232326] px-2 py-1'>
                      <span className='text-[10px] font-semibold uppercase tracking-wide text-slate-300'>{section.badge}</span>
                    </div>
                  </div>
                  <p className='text-sm font-semibold text-white'>{section.title}</p>
                  <p className='mt-1 text-xs text-slate-400'>{section.subtitle}</p>
                  <span className='mt-3 inline-flex rounded-md border border-white/15 px-2.5 py-1 text-[11px] text-cyan-200 transition group-hover:border-cyan-300/60'>
                    {section.cta}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className='chess-card'>
          <p className='text-xs uppercase tracking-[0.14em] text-slate-400'>Quick Access</p>
          <h3 className='mt-1 text-xl font-bold text-white'>Play Faster, Improve Daily</h3>
          <p className='mt-2 max-w-2xl text-sm text-slate-300'>
            Use this shortcut row for the most common actions from your chess workflow.
          </p>

          <div className='mt-4 grid grid-cols-2 gap-2 md:grid-cols-4'>
            <button
              onClick={onPlayClick}
              className='chess-btn-primary'
            >
              Create Game
            </button>
            <button
              onClick={onPlayClick}
              className='chess-btn-secondary'
            >
              Challenge Friend
            </button>
            <button
              onClick={onLearnClick}
              className='chess-btn-secondary'
            >
              Study Board
            </button>
            <button
              onClick={onPuzzlesClick}
              className='chess-btn-secondary'
            >
              Daily Puzzle
            </button>
          </div>
        </div>

        <div className='rounded-2xl border border-white/10 bg-[#252526]/85 p-5 backdrop-blur'>
          <div className='mb-3 flex items-center justify-between'>
            <h2 className='text-lg font-semibold text-white'>Quick Pairing Pools</h2>
            <span className='text-xs text-slate-400'>~{totalPlayers}k players online</span>
          </div>
          <div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
            {quickPairings.map((pool) => (
              <button
                key={pool.id}
                onClick={onPlayClick}
                className='rounded-xl border border-white/10 bg-[#2d2d30] px-3 py-2 text-left transition hover:border-emerald-300/50 hover:bg-[#35353a]'
              >
                <p className='text-sm font-semibold text-white'>{pool.id}</p>
                <p className='text-xs text-slate-400'>{pool.label} • {pool.players}</p>
              </button>
            ))}
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          <div className='rounded-2xl border border-white/10 bg-[#252526]/85 p-5 backdrop-blur'>
            <h3 className='mb-3 text-lg font-semibold text-white'>Featured Events</h3>
            <div className='space-y-2'>
              {spotlightEvents.map((event) => (
                <div key={event.title} className='flex items-center justify-between rounded-lg bg-[#2d2d30] px-3 py-2'>
                  <div>
                    <p className='text-sm font-semibold text-slate-100'>{event.title}</p>
                    <p className='text-xs text-slate-400'>{event.subtitle}</p>
                  </div>
                  <button
                    onClick={onWatchClick}
                    className='rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-200 transition hover:border-cyan-300/60'
                  >
                    {event.action}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className='rounded-2xl border border-white/10 bg-[#252526]/85 p-5 backdrop-blur'>
            <h3 className='mb-3 text-lg font-semibold text-white'>Timeline</h3>
            <div className='space-y-2'>
              {timeline.map((entry) => (
                <div key={entry.id} className='rounded-lg bg-[#2d2d30] px-3 py-2'>
                  <p className='text-sm text-slate-200'>{entry.text}</p>
                  <p className='text-[11px] text-slate-500'>{entry.time}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        </section>

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
                    <button
                      type='button'
                      onClick={() => openPlayerDetails(player)}
                      className='w-full truncate text-left text-sm font-semibold text-slate-100 hover:text-cyan-200'
                      title={player.playerSlug ? 'Show player details' : 'Player profile unavailable'}
                    >
                      <span
                        className={`mr-2 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          player.isLive
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-500/20 text-slate-300'
                        }`}
                        title={player.isLive && player.liveUrl ? player.liveUrl : 'No live game detected'}
                      >
                        {player.isLive ? 'Live' : 'Idle'}
                      </span>
                      {formatPlayerName(player.name)}
                    </button>
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
            <h3 className='mb-2 text-lg font-semibold text-white'>Today\'s Puzzle</h3>
            <p className='text-sm text-slate-300'>White to move and win material in 3.</p>
            <button
              onClick={onPuzzlesClick}
              className='mt-3 w-full rounded-lg bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110'
            >
              Solve Now
            </button>
          </section>

          <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-5 backdrop-blur'>
            <h3 className='mb-2 text-lg font-semibold text-white'>Openings To Train</h3>
            <ul className='space-y-2 text-sm text-slate-300'>
              <li className='rounded-lg bg-[#2d2d30] px-3 py-2'>Sicilian Defense: Najdorf</li>
              <li className='rounded-lg bg-[#2d2d30] px-3 py-2'>Queen\'s Gambit Declined</li>
              <li className='rounded-lg bg-[#2d2d30] px-3 py-2'>Ruy Lopez: Berlin Endgame</li>
            </ul>
          </section>

          <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-5 backdrop-blur'>
            <h3 className='mb-2 text-lg font-semibold text-white'>Community</h3>
            <p className='text-sm text-slate-300'>Forums, teams, and study groups are active now.</p>
            <button
              onClick={onWatchClick}
              className='mt-3 w-full rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10'
            >
              Open Live Watch
            </button>
          </section>
        </aside>
      </div>

      {selectedPlayer && (
        <div className='fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-6'>
          <div className='max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[#252526] p-5 shadow-2xl'>
            <div className='mb-4 flex items-start justify-between gap-3'>
              <div>
                <p className='text-xs uppercase tracking-[0.14em] text-slate-400'>Player Details</p>
                <h3 className='text-xl font-bold text-white'>
                  {playerDetails?.name || formatPlayerName(selectedPlayer.name)}
                </h3>
              </div>
              <button
                type='button'
                onClick={closePlayerDetails}
                className='rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:border-cyan-300/60'
              >
                Close
              </button>
            </div>

            {playerDetailsLoading && <p className='text-sm text-slate-300'>Loading player details...</p>}
            {!playerDetailsLoading && playerDetailsError && <p className='text-sm text-red-300'>{playerDetailsError}</p>}

            {!playerDetailsLoading && !playerDetailsError && playerDetails && (
              <div className='space-y-4'>
                <div className='flex flex-col gap-4 sm:flex-row'>
                  {playerDetails.photoUrl && !playerImageFailed && (
                    <img
                      src={playerDetails.photoUrl}
                      alt={playerDetails.name || 'Player'}
                      className='h-28 w-28 rounded-xl border border-white/10 object-cover'
                      onError={() => setPlayerImageFailed(true)}
                    />
                  )}
                  {(!playerDetails.photoUrl || playerImageFailed) && (
                    <div className='grid h-28 w-28 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-[#3a3a3f] to-[#2b2b2f] text-2xl font-bold text-slate-100'>
                      {String(playerDetails.name || selectedPlayer.name || '?')
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase() || '')
                        .join('') || '?'}
                    </div>
                  )}
                  <div className='grid flex-1 grid-cols-2 gap-2 text-sm'>
                    <div className='rounded-lg bg-[#2d2d30] px-3 py-2 text-slate-200'>Live: <span className='font-semibold text-white'>{playerDetails.liveRating ?? '-'}</span></div>
                    <div className='rounded-lg bg-[#2d2d30] px-3 py-2 text-slate-200'>FIDE: <span className='font-semibold text-white'>{playerDetails.fideRating ?? '-'}</span></div>
                    <div className='rounded-lg bg-[#2d2d30] px-3 py-2 text-slate-200'>World Rank: <span className='font-semibold text-white'>#{playerDetails.worldRank ?? '-'}</span></div>
                    <div className='rounded-lg bg-[#2d2d30] px-3 py-2 text-slate-200'>Country Rank: <span className='font-semibold text-white'>#{playerDetails.countryRank ?? '-'}</span></div>
                  </div>
                </div>

                <div className='grid grid-cols-1 gap-2 text-sm text-slate-300 sm:grid-cols-2'>
                  <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>Country: <span className='text-slate-100'>{playerDetails.country || '-'}</span></p>
                  <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>Age: <span className='text-slate-100'>{playerDetails.age || '-'}</span></p>
                  <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>Born: <span className='text-slate-100'>{playerDetails.born || '-'}</span></p>
                  <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>FIDE ID: <span className='text-slate-100'>{playerDetails.fideId || '-'}</span></p>
                  <p className='rounded-lg bg-[#2d2d30] px-3 py-2 sm:col-span-2'>Location: <span className='text-slate-100'>{playerDetails.location || '-'}</span></p>
                </div>

                <div className='grid grid-cols-2 gap-2 text-sm text-slate-300 sm:grid-cols-4'>
                  <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>Games: <span className='text-slate-100'>{playerDetails.totalGames ?? '-'}</span></p>
                  <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>Wins: <span className='text-slate-100'>{playerDetails.wins ?? '-'}</span></p>
                  <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>Losses: <span className='text-slate-100'>{playerDetails.losses ?? '-'}</span></p>
                  <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>Draws: <span className='text-slate-100'>{playerDetails.draws ?? '-'}</span></p>
                </div>

                <div className='grid grid-cols-2 gap-2 text-sm text-slate-300 sm:grid-cols-4'>
                  <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>Score: <span className='text-slate-100'>{playerDetails.totalScore || '-'}</span></p>
                  <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>12m Perf: <span className='text-slate-100'>{playerDetails.performance12m ?? '-'}</span></p>
                  <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>Wins %: <span className='text-slate-100'>{playerDetails.winsPct || '-'}</span></p>
                  <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>Loss %: <span className='text-slate-100'>{playerDetails.lossesPct || '-'}</span></p>
                </div>

                <div className='grid grid-cols-1 gap-2 text-sm text-slate-300 sm:grid-cols-2'>
                  <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>Rapid: <span className='text-slate-100'>{playerDetails.rapid?.rating ?? '-'}</span> (#{playerDetails.rapid?.worldRank ?? '-'})</p>
                  <p className='rounded-lg bg-[#2d2d30] px-3 py-2'>Blitz: <span className='text-slate-100'>{playerDetails.blitz?.rating ?? '-'}</span> (#{playerDetails.blitz?.worldRank ?? '-'})</p>
                </div>

                <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                  <div className='rounded-lg bg-[#2d2d30] p-3'>
                    <p className='mb-2 text-xs uppercase tracking-[0.12em] text-slate-400'>Top Openings As White</p>
                    <div className='space-y-1 text-sm text-slate-200'>
                      {(playerDetails.openings?.white || []).map((line) => (
                        <p key={`white-${line}`}>{line}</p>
                      ))}
                      {!playerDetails.openings?.white?.length && <p className='text-slate-400'>No opening data</p>}
                    </div>
                  </div>

                  <div className='rounded-lg bg-[#2d2d30] p-3'>
                    <p className='mb-2 text-xs uppercase tracking-[0.12em] text-slate-400'>Top Openings As Black</p>
                    <div className='space-y-1 text-sm text-slate-200'>
                      {(playerDetails.openings?.black || []).map((line) => (
                        <p key={`black-${line}`}>{line}</p>
                      ))}
                      {!playerDetails.openings?.black?.length && <p className='text-slate-400'>No opening data</p>}
                    </div>
                  </div>
                </div>

                <div className='rounded-lg bg-[#2d2d30] p-3'>
                  <p className='mb-2 text-xs uppercase tracking-[0.12em] text-slate-400'>Rating History</p>
                  <div className='max-h-56 overflow-auto'>
                    <table className='w-full text-left text-sm text-slate-200'>
                      <thead className='sticky top-0 bg-[#2d2d30] text-xs text-slate-400'>
                        <tr>
                          <th className='px-2 py-1'>Date</th>
                          <th className='px-2 py-1'>Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(playerDetails.ratingHistory || []).map((entry) => (
                          <tr key={`${entry.date}-${entry.rating}`} className='border-t border-white/5'>
                            <td className='px-2 py-1'>{entry.date}</td>
                            <td className='px-2 py-1 font-semibold text-white'>{entry.rating}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!playerDetails.ratingHistory?.length && <p className='text-sm text-slate-400'>No history available</p>}
                  </div>
                </div>

                <div className='space-y-3 rounded-lg bg-[#2d2d30] p-3'>
                  <p className='text-xs uppercase tracking-[0.12em] text-slate-400'>Profile Sections</p>
                  {[
                    ['Championships', playerDetails.sections?.championships],
                    ['Ratings', playerDetails.sections?.ratings],
                    ['Titles', playerDetails.sections?.titles],
                    ['Classical Tournaments', playerDetails.sections?.classicalTournaments],
                    ['Team Events', playerDetails.sections?.teamEvents]
                  ].map(([title, content]) => (
                    <div key={title} className='space-y-1'>
                      <h4 className='text-sm font-semibold text-white'>{title}</h4>
                      {toParagraphs(content).map((para) => (
                        <p key={`${title}-${para.slice(0, 30)}`} className='text-sm text-slate-300'>
                          {para}
                        </p>
                      ))}
                      {!content && <p className='text-sm text-slate-500'>No data</p>}
                    </div>
                  ))}
                </div>

                <div className='flex flex-wrap gap-2 text-xs'>
                  <a href={playerDetails.sourceUrl} target='_blank' rel='noreferrer' className='rounded-md border border-white/15 px-2.5 py-1 text-slate-200 hover:border-cyan-300/60'>2700chess Profile</a>
                  {playerDetails.gamesArchiveUrl && <a href={playerDetails.gamesArchiveUrl} target='_blank' rel='noreferrer' className='rounded-md border border-white/15 px-2.5 py-1 text-slate-200 hover:border-cyan-300/60'>Games Archive</a>}
                  {playerDetails.links?.fide && <a href={playerDetails.links.fide} target='_blank' rel='noreferrer' className='rounded-md border border-white/15 px-2.5 py-1 text-slate-200 hover:border-cyan-300/60'>FIDE</a>}
                  {playerDetails.links?.wikipedia && <a href={playerDetails.links.wikipedia} target='_blank' rel='noreferrer' className='rounded-md border border-white/15 px-2.5 py-1 text-slate-200 hover:border-cyan-300/60'>Wikipedia</a>}
                </div>

                <section className='rounded-lg bg-[#2d2d30] p-3'>
                  <div className='mb-2 flex items-center justify-between'>
                    <p className='text-xs uppercase tracking-[0.12em] text-slate-400'>Player Games</p>
                    <span className='text-xs text-slate-500'>Page {playerGamesPage}</span>
                  </div>

                  {playerGamesLoading && !playerGames.length && <p className='text-sm text-slate-400'>Loading games...</p>}
                  {playerGamesError && <p className='mb-2 text-sm text-red-300'>{playerGamesError}</p>}

                  {!playerGamesLoading && !playerGames.length && !playerGamesError && (
                    <p className='text-sm text-slate-400'>No games found for this player.</p>
                  )}

                  {!!playerGames.length && (
                    <div className='max-h-64 overflow-auto rounded border border-white/5'>
                      <table className='w-full text-left text-sm text-slate-200'>
                        <thead className='sticky top-0 bg-[#2d2d30] text-xs text-slate-400'>
                          <tr>
                            <th className='px-2 py-1'>Date</th>
                            <th className='px-2 py-1'>Pairing</th>
                            <th className='px-2 py-1'>Result</th>
                            <th className='px-2 py-1'>Site</th>
                            <th className='px-2 py-1'>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playerGames.map((game) => (
                            <tr key={`${game.gamePath}-${game.index}`} className='border-t border-white/5'>
                              <td className='px-2 py-1 text-xs text-slate-300'>{game.date || '-'}</td>
                              <td className='px-2 py-1 text-xs'>
                                <p className='text-slate-100'>{game.white} vs {game.black}</p>
                                <p className='text-slate-500'>#{game.index} • {game.moves ?? '-'} moves</p>
                              </td>
                              <td className='px-2 py-1 text-xs text-slate-200'>{game.result || '-'}</td>
                              <td className='px-2 py-1 text-xs text-slate-300'>{game.site || '-'}</td>
                              <td className='px-2 py-1'>
                                <button
                                  type='button'
                                  onClick={() => analyzePlayerGame(game)}
                                  disabled={analyzingGamePath === game.gamePath}
                                  className='rounded border border-cyan-400/40 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-50'
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

                  <div className='mt-2 flex items-center justify-end gap-2'>
                    <button
                      type='button'
                      onClick={() => selectedPlayer?.playerSlug && loadPlayerGames(selectedPlayer.playerSlug, playerGamesPage + 1)}
                      disabled={!playerGamesHasMore || playerGamesLoading}
                      className='rounded border border-white/15 px-2.5 py-1 text-xs text-slate-200 hover:border-cyan-300/60 disabled:opacity-50'
                    >
                      {playerGamesLoading ? 'Loading...' : playerGamesHasMore ? 'Load More' : 'No More Games'}
                    </button>
                  </div>
                </section>

                {playerDetails.rawMarkdown && (
                  <details className='rounded-lg bg-[#2d2d30] p-3'>
                    <summary className='cursor-pointer text-sm font-semibold text-white'>Full Profile Text</summary>
                    <pre className='mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-300'>
                      {playerDetails.rawMarkdown}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default HomeSection
