import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { useStockfish } from '../hooks/useStockfish'
import { useSoundEffects } from '../hooks/useSoundEffects'
import { BOARD_THEMES, useBoardThemeStore } from '../store/useBoardThemeStore'
import { useAppStore } from '../store/useAppStore'
import { useAuthStore } from '../store/useAuthStore'
import { usePlayStore } from '../store/usePlayStore'
import { 
  evalToCentipawnsWhite,
  classificationSquareStyle,
  checkSquareStyle,
  FEEDBACK_ROWS,
  getMeta,
  classificationClasses
} from '../utils/reviewUtils'
import {
  fetchLichessBroadcastGamePgn,
  fetchLichessBroadcastRound,
  fetchLichessBroadcastRoundGameStreams,
  fetchLichessBroadcastTourByRound,
  fetchLichessBroadcastRoundStreams,
  fetchLichessBroadcasts,
  fetchLichessLiveStreamers,
  fetchLichessTournamentGames,
  fetchLichessTournaments
} from '../utils/lichessApi'
import { analyzeEngineDeterministic } from '../utils/aiReviewApi'
import { recordLearnProfile, recordLearnSession, recordWatchView } from '../utils/progressApi'
import { getStoredApiToken } from '../utils/authToken'

const LEARN_BOTS = [
  { id: 'martin', name: 'Martin', rating: 250, skillLevel: 2, depth: 8, powerMode: 'balanced', randomness: 0.2 },
  { id: 'jimmy', name: 'Jimmy', rating: 650, skillLevel: 5, depth: 10, powerMode: 'balanced', randomness: 0.12 },
  { id: 'isabel', name: 'Isabel', rating: 1100, skillLevel: 9, depth: 13, powerMode: 'balanced', randomness: 0.06 },
  { id: 'nelson', name: 'Nelson', rating: 1450, skillLevel: 12, depth: 15, powerMode: 'strong', randomness: 0.03 },
  { id: 'antonio', name: 'Antonio', rating: 1800, skillLevel: 16, depth: 17, powerMode: 'strong', randomness: 0.015 },
  { id: 'max', name: 'Maximum', rating: 2350, skillLevel: 20, depth: 22, powerMode: 'max', randomness: 0 }
]

const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
}

const BOT_AVATAR_PALETTES = [
  { bg1: '#2f80ed', bg2: '#56ccf2', coat: '#1f2937', shirt: '#60a5fa', skin: '#f1c7a3', hair: '#111827', piece: '#f8fafc' },
  { bg1: '#11998e', bg2: '#38ef7d', coat: '#1f2937', shirt: '#10b981', skin: '#f2c6a0', hair: '#111827', piece: '#ecfeff' },
  { bg1: '#7f00ff', bg2: '#e100ff', coat: '#312e81', shirt: '#a78bfa', skin: '#efc19c', hair: '#1f2937', piece: '#f5f3ff' },
  { bg1: '#ff6a00', bg2: '#ee0979', coat: '#3f3f46', shirt: '#fb7185', skin: '#f1bf95', hair: '#1f2937', piece: '#fff7ed' },
  { bg1: '#0f2027', bg2: '#2c5364', coat: '#111827', shirt: '#22d3ee', skin: '#efc39f', hair: '#f8fafc', piece: '#e0f2fe' },
  { bg1: '#1d4350', bg2: '#a43931', coat: '#3f3f46', shirt: '#f97316', skin: '#eebd93', hair: '#111827', piece: '#fff1f2' },
  { bg1: '#2b5876', bg2: '#4e4376', coat: '#1f2937', shirt: '#818cf8', skin: '#f2caa8', hair: '#0f172a', piece: '#eef2ff' },
  { bg1: '#355c7d', bg2: '#c06c84', coat: '#111827', shirt: '#f472b6', skin: '#f0c8a5', hair: '#1f2937', piece: '#fdf2f8' }
]

function hashString(value) {
  const input = String(value || '')
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h >>> 0)
}

function createBotAvatarDataUri({ label, palette, pieceGlyph }) {
  const safeLabel = String(label || '').replace(/[&<>'"]/g, '')
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${safeLabel}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.bg1}"/>
      <stop offset="100%" stop-color="${palette.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="14" fill="url(#g)"/>
  <circle cx="48" cy="34" r="17" fill="${palette.skin}"/>
  <path d="M29 25c2-11 36-11 38 0 0 0-3 8-19 8s-19-8-19-8Z" fill="${palette.hair}"/>
  <circle cx="42" cy="35" r="1.8" fill="#111827"/>
  <circle cx="54" cy="35" r="1.8" fill="#111827"/>
  <path d="M42 42c2.5 2.4 9.5 2.4 12 0" stroke="#7c2d12" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M14 94c2-20 14-30 34-30s32 10 34 30" fill="${palette.coat}"/>
  <path d="M29 94c2-15 10-22 19-22s17 7 19 22" fill="${palette.shirt}"/>
  <circle cx="48" cy="69" r="8" fill="${palette.piece}" opacity="0.95"/>
  <text x="48" y="73" text-anchor="middle" font-size="10" font-family="Segoe UI, Arial" fill="#0f172a">${pieceGlyph}</text>
</svg>`.trim()
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function buildBotAvatarMap(hourKey) {
  const glyphs = ['K', 'Q', 'R', 'B', 'N', 'P']
  const map = {}

  for (const bot of LEARN_BOTS) {
    const seed = hashString(`${bot.id}-${hourKey}`)
    const palette = BOT_AVATAR_PALETTES[seed % BOT_AVATAR_PALETTES.length]
    const glyph = glyphs[seed % glyphs.length]
    map[bot.id] = createBotAvatarDataUri({
      label: bot.name,
      palette,
      pieceGlyph: glyph
    })
  }

  const selfSeed = hashString(`you-${hourKey}`)
  map.__you = createBotAvatarDataUri({
    label: 'You',
    palette: BOT_AVATAR_PALETTES[selfSeed % BOT_AVATAR_PALETTES.length],
    pieceGlyph: 'YOU'
  })

  return map
}

const StableLiveBoard = memo(function StableLiveBoard({
  position,
  isDraggable,
  onPieceDrop,
  boardWidth,
  darkSquareStyle,
  lightSquareStyle,
  arrows,
  squareStyles
}) {
  return (
    <Chessboard
      id='tournament-board'
      position={position}
      arePiecesDraggable={isDraggable}
      onPieceDrop={onPieceDrop}
      boardWidth={boardWidth}
      animationDuration={200}
      customDarkSquareStyle={darkSquareStyle}
      customLightSquareStyle={lightSquareStyle}
      customArrows={arrows}
      customSquareStyles={squareStyles}
    />
  )
})

function LichessWatch({ socket, analysisOnly = false, hideLiveOptions = false }) {
  const themeId = useBoardThemeStore((state) => state.themeId)
  const boardTheme = useMemo(() => BOARD_THEMES.find((theme) => theme.id === themeId) || BOARD_THEMES[0], [themeId])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tournaments, setTournaments] = useState([])
  const [tournamentGames, setTournamentGames] = useState([])
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [selectedTournamentGame, setSelectedTournamentGame] = useState(null)

  const [isGameViewerOpen, setIsGameViewerOpen] = useState(false)
  const [followLive, setFollowLive] = useState(true)
  const [tournamentPly, setTournamentPly] = useState(0)
  const [tournamentAutoPlay, setTournamentAutoPlay] = useState(false)
  const [tournamentLastUpdated, setTournamentLastUpdated] = useState(null)
  const [tournamentLoading, setTournamentLoading] = useState(false)
  const [tournamentError, setTournamentError] = useState('')
  const [broadcasts, setBroadcasts] = useState([])
  const [broadcastsLoading, setBroadcastsLoading] = useState(false)
  const [broadcastDirectStreams, setBroadcastDirectStreams] = useState([])
  const [broadcastStreamsByGame, setBroadcastStreamsByGame] = useState({})
  const [previousBroadcastQuery, setPreviousBroadcastQuery] = useState('')
  const [searchedPastBroadcasts, setSearchedPastBroadcasts] = useState([])
  const [pastSearchLoading, setPastSearchLoading] = useState(false)
  const [broadcastRoundsLoadingById, setBroadcastRoundsLoadingById] = useState({})
  const [enrichedBroadcastIds, setEnrichedBroadcastIds] = useState({})
  const [expandedBroadcastId, setExpandedBroadcastId] = useState('')
  const [liveStreamers, setLiveStreamers] = useState([])
  const [streamersLoading, setStreamersLoading] = useState(false)
  const [streamersError, setStreamersError] = useState('')
  const [selectedStreamerUrl, setSelectedStreamerUrl] = useState('')
  const [isStreamTheaterOpen, setIsStreamTheaterOpen] = useState(false)
  const [isMiniPlayerOpen, setIsMiniPlayerOpen] = useState(false)
  const [miniPlayerPosition, setMiniPlayerPosition] = useState({ x: 24, y: 24 })
  const [isMiniDragging, setIsMiniDragging] = useState(false)
  const [selectedBroadcast, setSelectedBroadcast] = useState(null)
  const [selectedBroadcastRound, setSelectedBroadcastRound] = useState(null)
  const [boardWidth, setBoardWidth] = useState(560)
  const [thumbBoardWidth, setThumbBoardWidth] = useState(170)
  const [learnFen, setLearnFen] = useState('')
  const [learnHistory, setLearnHistory] = useState([])
  const [learnMoves, setLearnMoves] = useState([])
  const [learnPly, setLearnPly] = useState(0)
  const [botThinking, setBotThinking] = useState(false)
  const [selectedBotId, setSelectedBotId] = useState('nelson')
  const [meVsBotAnalysisEnabled, setMeVsBotAnalysisEnabled] = useState(false)
  const [avatarHourKey, setAvatarHourKey] = useState(() => Math.floor(Date.now() / 3600000))
  const [displayEvalForWhite, setDisplayEvalForWhite] = useState(0)
  const [displayEngineArrows, setDisplayEngineArrows] = useState([])
  const [isBoardAnimating, setIsBoardAnimating] = useState(false)
  const [liveFenHistoryByGame, setLiveFenHistoryByGame] = useState({})
  const [displayClocks, setDisplayClocks] = useState({ white: null, black: null })
  const [qualityRows, setQualityRows] = useState([])
  const [qualityRunning, setQualityRunning] = useState(false)
  const [qualityError, setQualityError] = useState('')
  const [qualityProgress, setQualityProgress] = useState({ current: 0, total: 0 })
  const [detectedOpening, setDetectedOpening] = useState({ name: '', eco: '' })
  const [detectingOpening, setDetectingOpening] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [playerProfile, setPlayerProfile] = useState(null)
  const [playerProfileLoading, setPlayerProfileLoading] = useState(false)
  const [playerProfileError, setPlayerProfileError] = useState('')
  const mainBoardContainerRef = useRef(null)
  const analysisDebounceRef = useRef(null)
  const lastAnalysisKeyRef = useRef('')
  const lastAutoQualityKeyRef = useRef('')
  const lastWatchUpdateRef = useRef(0)
  const lastPlySoundRef = useRef(null)
  const analysisBootstrapRef = useRef(false)
  const learnBaseGameIdRef = useRef('')
  const botThinkingRef = useRef(false)
  const watchedGameIdsRef = useRef(new Set())
  const learnSessionRecordedRef = useRef(false)
  const isLoadDataRunningRef = useRef(false)
  const lastDeepBroadcastFetchRef = useRef(0)
  const followLiveRef = useRef(true)
  const boardWidthRef = useRef(560)
  const thumbBoardWidthRef = useRef(170)
  const lastAnimatedFenRef = useRef('')
  const miniDragOffsetRef = useRef({ x: 0, y: 0 })
  const avatarHourTimeoutRef = useRef(null)
  const avatarHourIntervalRef = useRef(null)
  const { unlockAudio, playMove, playCapture, playCastle, playCheck, playPromotion, playGameEnd } = useSoundEffects()
  const apiToken = useAuthStore((state) => state.apiToken)
  const collapsed = useAppStore((state) => state.collapsed)
  const mobileOpen = useAppStore((state) => state.mobileOpen)
  const reviewIntent = usePlayStore((state) => state.reviewIntent)
  const clearReviewIntent = usePlayStore((state) => state.clearReviewIntent)
  const {
    ready: engineReady,
    nnueEnabled,
    nnueMode,
    nnueNetworks,
    selectedNnueNetworkId,
    isAnalyzing,
    bestMove,
    evaluation,
    pvLines,
    skillLevel,
    powerMode,
    analysisDepth,
    error: engineError,
    analyzeFen,
    analyzeFenAsync,
    setNnueMode,
    setNnueNetwork,
    setSkillLevel,
    setPowerMode,
    setAnalysisDepth
  } = useStockfish()

  const selectedBot = useMemo(
    () => LEARN_BOTS.find((bot) => bot.id === selectedBotId) || LEARN_BOTS[0],
    [selectedBotId]
  )

  const botAvatars = useMemo(() => buildBotAvatarMap(avatarHourKey), [avatarHourKey])
  const selectedBotAvatar = botAvatars[selectedBot.id] || ''
  const youAvatar = botAvatars.__you || ''

  const countMoves = (g) => String(g?.moves || '').trim().split(/\s+/).filter(Boolean).length

  const toMoveUci = (move) => {
    if (!move?.from || !move?.to) return ''
    const promotion = move.promotion ? String(move.promotion).toLowerCase() : ''
    return `${move.from}${move.to}${promotion}`
  }

  const scoreFallbackMove = (move) => {
    if (!move) return -999
    const to = String(move.to || '')
    const file = to.charCodeAt(0) - 97
    const rank = Number(to[1] || 0)
    const centerDistance = Number.isFinite(file) && Number.isFinite(rank)
      ? Math.abs(file - 3.5) + Math.abs(rank - 4.5)
      : 8
    const captureValue = move.captured ? (PIECE_VALUES[String(move.captured).toLowerCase()] || 0) : 0
    const promotionBonus = move.promotion ? 7 : 0
    const checkBonus = String(move.san || '').includes('+') ? 2.5 : 0
    const centerBonus = Math.max(0, 4 - centerDistance) * 0.35
    const developBonus = String(move.piece || '').toLowerCase() === 'n' || String(move.piece || '').toLowerCase() === 'b' ? 0.4 : 0
    return captureValue * 3 + promotionBonus + checkBonus + centerBonus + developBonus
  }

  const pickFallbackMove = (legalMoves) => {
    if (!Array.isArray(legalMoves) || legalMoves.length === 0) return null
    return [...legalMoves]
      .sort((a, b) => scoreFallbackMove(b) - scoreFallbackMove(a))[0] || legalMoves[0]
  }

  const toWhitePerspectiveEval = (engineEvaluation, fen) => {
    if (!engineEvaluation) return null
    const sideToMove = String(fen || '').split(' ')[1] || 'w'
    const stmSign = sideToMove === 'w' ? 1 : -1

    if (engineEvaluation.type === 'cp') {
      return {
        ...engineEvaluation,
        type: 'cp',
        value: Math.round(Number(engineEvaluation.value || 0) * stmSign)
      }
    }

    if (engineEvaluation.type === 'mate') {
      return {
        ...engineEvaluation,
        type: 'mate',
        value: Math.round(Number(engineEvaluation.value || 0) * stmSign)
      }
    }

    return null
  }

  const isExpectedAnalysisCancel = (err) => {
    const msg = String(err?.message || err || '').toLowerCase()
    return msg.includes('analysis canceled')
      || msg.includes('previous analysis canceled')
      || msg.includes('analysis stopped')
      || msg.includes('engine mode changed')
      || msg.includes('engine power changed')
      || msg.includes('engine restarting')
      || msg.includes('worker error')
      || msg.includes('stockfish is still loading')
  }

  const classifyWatchMove = ({ playedMoveUci, bestMoveUci, evalBefore, evalAfter, moveColor, ply }) => {
    if (!playedMoveUci || !evalBefore || !evalAfter || !moveColor) {
      return { label: 'Good', lossCp: 0 }
    }

    const beforeCp = evalToCentipawnsWhite(evalBefore)
    const afterCp = evalToCentipawnsWhite(evalAfter)
    const beforeForMover = moveColor === 'w' ? beforeCp : -beforeCp
    const afterForMover = moveColor === 'w' ? afterCp : -afterCp
    const lossCp = Math.max(0, beforeForMover - afterForMover)
    const gainCp = afterForMover - beforeForMover
    const isBest = playedMoveUci === bestMoveUci

    if (ply <= 16 && lossCp <= 18) return { label: 'Book', lossCp }
    if (beforeForMover >= 320 && afterForMover <= 90 && lossCp >= 180) return { label: 'Missed Win', lossCp }

    if (isBest) {
      if (gainCp >= 260) return { label: 'Brilliant', lossCp }
      if (gainCp >= 140) return { label: 'Outstanding', lossCp }
      return { label: 'Best', lossCp }
    }

    if (lossCp <= 35 && Math.abs(gainCp) >= 70) return { label: 'Sharp', lossCp }
    if (lossCp <= 60) return { label: 'Good', lossCp }
    if (lossCp <= 120) return { label: 'Inaccuracy', lossCp }
    if (lossCp <= 250) return { label: 'Mistake', lossCp }
    return { label: 'Blunder', lossCp }
  }

  const qualityBadgeClass = (label) => {
    if (label === 'Book') return 'bg-slate-500/20 text-slate-200 border-slate-300/40'
    if (label === 'Genius' || label === 'Brilliant') return 'bg-cyan-500/20 text-cyan-200 border-cyan-300/40'
    if (label === 'Outstanding') return 'bg-violet-500/20 text-violet-200 border-violet-300/40'
    if (label === 'Sharp') return 'bg-sky-500/20 text-sky-200 border-sky-300/40'
    if (label === 'Best') return 'bg-emerald-500/20 text-emerald-200 border-emerald-300/40'
    if (label === 'Good') return 'bg-cyan-500/20 text-cyan-200 border-cyan-300/40'
    if (label === 'Inaccuracy') return 'bg-yellow-500/20 text-yellow-200 border-yellow-300/40'
    if (label === 'Mistake') return 'bg-orange-500/20 text-orange-200 border-orange-300/40'
    if (label === 'Missed Win') return 'bg-rose-500/20 text-rose-200 border-rose-300/40'
    return 'bg-red-500/20 text-red-200 border-red-300/40'
  }

  const moveMarkerForLabel = (label) => {
    if (label === 'Brilliant') return { text: '!!', bg: '#38bdf8' }
    if (label === 'Best') return { text: '⭐', bg: '#22c55e' }
    if (label === 'Good') return { text: '✓', bg: '#14b8a6' }
    if (label === 'Outstanding') return { text: '◔', bg: '#6366f1' }
    if (label === 'Inaccuracy') return { text: '⚠', bg: '#f59e0b' }
    if (label === 'Mistake') return { text: '?', bg: '#fb923c' }
    if (label === 'Blunder') return { text: '✕', bg: '#ef4444' }
    if (label === 'Missed Win') return { text: '🏆', bg: '#ef4444' }
    if (label === 'Book') return { text: '📖', bg: '#94a3b8' }
    return { text: '!', bg: '#60a5fa' }
  }

  const federationToFlag = (code) => {
    const value = String(code || '').trim().toUpperCase()
    if (!/^[A-Z]{2,3}$/.test(value)) return ''
    const normalized = value.length === 3 ? value.slice(0, 2) : value
    return normalized
      .split('')
      .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
      .join('')
  }

  const initials = (name) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return '?'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }

  const displayName = (name) => {
    const raw = String(name || '').replace(/\s+/g, ' ').trim()
    if (!raw) return 'Player'
    if (!raw.includes(',')) return raw

    const parts = raw.split(',').map((part) => part.trim()).filter(Boolean)
    if (parts.length < 2) return raw.replace(',', '').trim()

    const [lastName, ...rest] = parts
    return `${rest.join(' ')} ${lastName}`.replace(/\s+/g, ' ').trim()
  }

  const toEmbeddedStreamUrl = (url) => {
    const raw = String(url || '').trim()
    if (!raw) return ''

    try {
      const parsed = new URL(raw)
      const host = parsed.hostname.toLowerCase()

      const withOrigin = (base) => {
        if (!base) return ''
        try {
          const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
          const glue = base.includes('?') ? '&' : '?'
          return `${base}${glue}rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(origin)}`
        } catch {
          return `${base}${base.includes('?') ? '&' : '?'}rel=0&modestbranding=1&playsinline=1&enablejsapi=1`
        }
      }

      if (host.includes('youtube.com')) {
        const id = parsed.searchParams.get('v')
        if (id) return withOrigin(`https://www.youtube.com/embed/${encodeURIComponent(id)}`)

        const parts = parsed.pathname.split('/').filter(Boolean)
        const embedIndex = parts.findIndex((part) => part === 'embed' || part === 'live' || part === 'shorts')
        if (embedIndex >= 0 && parts[embedIndex + 1]) {
          return withOrigin(`https://www.youtube.com/embed/${encodeURIComponent(parts[embedIndex + 1])}`)
        }
      }

      if (host === 'youtu.be') {
        const id = parsed.pathname.replace(/^\//, '')
        if (id) return withOrigin(`https://www.youtube.com/embed/${encodeURIComponent(id)}`)
      }

      if (host.includes('twitch.tv')) {
        const segments = parsed.pathname.split('/').filter(Boolean)
        const channel = segments[0] || ''
        if (channel) {
          const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
          return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(parent)}&muted=true`
        }
      }

      if (host.includes('kick.com')) {
        return raw
      }

      return raw
    } catch {
      return raw
    }
  }

  const refreshLiveStreamers = async ({ preserveSelection = true } = {}) => {
    setStreamersLoading(true)
    setStreamersError('')

    try {
      const payload = await fetchLichessLiveStreamers(36)
      const streamers = Array.isArray(payload?.streamers) ? payload.streamers : []
      setLiveStreamers(streamers)

      if (!preserveSelection) {
        setSelectedStreamerUrl('')
      }
    } catch (error) {
      setLiveStreamers([])
      setStreamersError(error?.message || 'Failed to load live videos')
    } finally {
      setStreamersLoading(false)
    }
  }

  const formatClock = (ms) => {
    if (typeof ms !== 'number' || Number.isNaN(ms) || ms < 0) return '--:--'
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor(totalSeconds / 60)
    const minutePart = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) {
      return `${hours}:${String(minutePart).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  const normalizeClockMs = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return null
    // Lichess relay broadcast clocks are in centiseconds.
    return Math.max(0, Math.floor(value * 10))
  }

  const playerOutcome = (game, color) => {
    if (!game) return 'GAME'
    if (game.ongoing || game.status === '*') return 'LIVE'

    if (game.winner === 'white') return color === 'white' ? 'WON' : 'LOST'
    if (game.winner === 'black') return color === 'black' ? 'WON' : 'LOST'

    const token = String(game.status || '')
      .replace(/Â/g, '')
      .replace(/½/g, '1/2')
      .trim()

    if (token === '1-0') return color === 'white' ? 'WON' : 'LOST'
    if (token === '0-1') return color === 'black' ? 'WON' : 'LOST'
    if (token === '1/2-1/2' || token.toLowerCase().includes('draw')) return 'DRAW'

    return 'GAME'
  }

  const normalizeStatusLabel = (status) => {
    const token = String(status || '')
      .replace(/Â/g, '')
      .replace(/½/g, '1/2')
      .trim()
    return token || '-'
  }

  const resultToWinner = (result) => {
    const token = String(result || '').toLowerCase()
    if (token === 'white-win' || token === 'black-timeout') return 'white'
    if (token === 'black-win' || token === 'white-timeout') return 'black'
    return null
  }

  const completedToWatchGame = (row, index) => {
    const moveList = Array.isArray(row?.moves) ? row.moves : []
    const moveString = moveList
      .map((m) => {
        const from = String(m?.from || '')
        const to = String(m?.to || '')
        const promotion = String(m?.promotion || '').toLowerCase()
        if (!from || !to) return ''
        return `${from}${to}${promotion}`
      })
      .filter(Boolean)
      .join(' ')

    return {
      id: String(row?.gameId || `review-${index}`),
      status: String(row?.result || row?.status || '-'),
      winner: resultToWinner(row?.result),
      ongoing: false,
      moves: moveString,
      pgn: String(row?.pgn || ''),
      initialFen: String(row?.initialFen || new Chess().fen()),
      fen: String(row?.fen || row?.finalFen || new Chess().fen()),
      opening: String(row?.analysis?.summary?.notes?.[0] || row?.reason || 'Completed game'),
      white: String(row?.whitePlayer || 'White'),
      black: String(row?.blackPlayer || 'Black'),
      whiteEmail: String(row?.whiteEmail || ''),
      blackEmail: String(row?.blackEmail || ''),
      whiteRating: '-',
      blackRating: '-',
      whiteFed: '',
      blackFed: '',
      whiteTitle: '',
      blackTitle: '',
      url: '',
      createdAt: row?.createdAt || null,
      endedAt: row?.endedAt || null
    }
  }

  const openPlayerProfile = async (username) => {
    const safeUsername = String(username || '').trim()
    if (!safeUsername) return

    setPlayerProfileLoading(true)
    setPlayerProfileError('')
    try {
      const response = await fetch(`/api/ratings/player/${encodeURIComponent(safeUsername)}`)
      const payload = await response.json()
      if (!response.ok || !payload?.success || !payload?.data) {
        throw new Error(payload?.error || 'Failed to load player profile')
      }
      setPlayerProfile(payload.data)
    } catch (error) {
      setPlayerProfile(null)
      setPlayerProfileError(error?.message || 'Failed to load player profile')
    } finally {
      setPlayerProfileLoading(false)
    }
  }

  const pickBestGame = (games) => {
    if (!games.length) return null

    return [...games].sort((a, b) => {
      const aLive = a.ongoing ? 1 : 0
      const bLive = b.ongoing ? 1 : 0
      if (aLive !== bLive) return bLive - aLive

      const aMoves = countMoves(a)
      const bMoves = countMoves(b)
      return bMoves - aMoves
    })[0]
  }

  const mergeEnrichedGames = (incomingGames, previousGames = []) => {
    const previousById = new Map(previousGames.map((g) => [g.id, g]))
    return incomingGames.map((game) => {
      const previous = previousById.get(game.id)
      if (!previous) return game
      return {
        ...game,
        pgn: game.pgn || previous.pgn || '',
        moves: game.moves || previous.moves || ''
      }
    })
  }

  const appendLiveFen = (gameId, fen) => {
    if (!gameId || !fen) return
    setLiveFenHistoryByGame((prev) => {
      const existing = prev[gameId] || []
      if (existing[existing.length - 1] === fen) return prev
      const next = [...existing, fen].slice(-220)
      return { ...prev, [gameId]: next }
    })
  }

  const parsePgnReplay = (rawPgn) => {
    const pgn = String(rawPgn || '').trim()
    if (!pgn) return null

    try {
      const cleaned = pgn
        .replace(/\r/g, ' ')
        .replace(/\{[^}]*\}/g, ' ')
        .replace(/\$\d+/g, ' ')

      const game = new Chess()
      game.loadPgn(cleaned, { strict: false })
      const verbose = game.history({ verbose: true })
      if (!verbose.length) return null

      const replay = new Chess()
      const fens = [replay.fen()]
      verbose.forEach((move) => {
        replay.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion || 'q'
        })
        fens.push(replay.fen())
      })

      return { fens, moves: verbose }
    } catch {
      // Fallback parser for relay PGNs that contain unusual symbols/formatting.
      try {
        const figurineMap = {
          '♔': 'K', '♕': 'Q', '♖': 'R', '♗': 'B', '♘': 'N', '♙': '',
          '♚': 'K', '♛': 'Q', '♜': 'R', '♝': 'B', '♞': 'N', '♟': ''
        }

        const normalized = pgn
          .replace(/\r/g, ' ')
          .replace(/\[[^\]]*\]/g, ' ')
          .replace(/\{[^}]*\}/g, ' ')
          .replace(/\$\d+/g, ' ')
          .replace(/[♔♕♖♗♘♙♚♛♜♝♞♟]/g, (m) => figurineMap[m] ?? m)
          .replace(/\s+/g, ' ')
          .trim()

        const replay = new Chess()
        const fens = [replay.fen()]
        const moves = []
        const tokens = normalized.split(' ').filter(Boolean)

        for (const tokenRaw of tokens) {
          const token = tokenRaw
            .replace(/^\d+\.(\.\.)?$/, '')
            .replace(/^(1-0|0-1|1\/2-1\/2|\*)$/, '')
            .trim()

          if (!token) continue

          const played = replay.move(token, { strict: false })
          if (!played) continue
          moves.push(played)
          fens.push(replay.fen())
        }

        if (!moves.length) return null
        return { fens, moves }
      } catch {
        return null
      }
    }
  }

  const selectGame = async (game, openViewer = true) => {
    if (!game) return
    setFollowLive(true)
    setSelectedTournamentGame(game)
    appendLiveFen(game.id, game.fen)
    setTournamentPly(9999)
    if (openViewer) setIsGameViewerOpen(true)

    if (!hideLiveOptions && game.id && !watchedGameIdsRef.current.has(game.id)) {
      watchedGameIdsRef.current.add(game.id)
      const source = selectedBroadcastRound ? 'broadcast' : 'tournament'
      recordWatchView({ source }).catch(() => {})
    }

    if (game.pgn) {
      const replay = parsePgnReplay(game.pgn)
      if (replay?.fens?.length) {
        setLiveFenHistoryByGame((prev) => ({ ...prev, [game.id]: replay.fens }))
        setTournamentPly(replay.fens.length - 1)
      }
    }

    if (selectedBroadcastRound && game.id && !game.pgn) {
      try {
        const data = await fetchLichessBroadcastGamePgn(selectedBroadcastRound, game.id)
        const nextPgn = String(data?.pgn || '').trim()
        if (!nextPgn) return

        const replay = parsePgnReplay(nextPgn)

        setTournamentGames((prev) => prev.map((g) => (g.id === game.id ? { ...g, pgn: nextPgn } : g)))
        setSelectedTournamentGame((prev) => (prev?.id === game.id ? { ...prev, pgn: nextPgn } : prev))
        if (replay?.fens?.length) {
          setLiveFenHistoryByGame((prev) => ({ ...prev, [game.id]: replay.fens }))
          setTournamentPly(replay.fens.length - 1)
        }
      } catch {
        // Keep FEN timeline fallback if PGN fetch fails.
      }
    }
  }

  const loadData = async () => {
    if (isLoadDataRunningRef.current) return
    isLoadDataRunningRef.current = true
    setLoading(true)
    setError('')

    try {
      const mergeBroadcastRows = (baseRows = [], nextRows = []) => {
        const seen = new Set()
        const merged = []

        for (const row of [...baseRows, ...nextRows]) {
          const key = String(row?.id || '').trim()
          if (!key || seen.has(key)) continue
          seen.add(key)
          merged.push(row)
        }

        return merged
      }

      // Quick fetch for fast first paint while still covering many live tournaments.
      setBroadcastsLoading(true)
      fetchLichessBroadcasts(900, 40)
        .then((payload) => {
          const quickRows = payload?.broadcasts || []
          setBroadcasts((prev) => mergeBroadcastRows(prev, quickRows))
        })
        .catch(() => {})
        .finally(() => setBroadcastsLoading(false))

      // Deep fetch is throttled so refresh cycles stay responsive.
      const now = Date.now()
      if (now - lastDeepBroadcastFetchRef.current > 60000) {
        lastDeepBroadcastFetchRef.current = now
        fetchLichessBroadcasts(2400, 120)
          .then((payload) => {
            const deepRows = payload?.broadcasts || []
            setBroadcasts((prev) => mergeBroadcastRows(prev, deepRows))
          })
          .catch(() => {})
      }

      const tour = await fetchLichessTournaments()

      const list = [
        ...(tour?.started || []),
        ...(tour?.created || []),
        ...(tour?.finished || [])
      ]

      const live = [
        ...(tour?.started || []),
        ...(tour?.created || [])
      ]

      setTournaments((live.length ? live : list).slice(0, 15))
    } catch (e) {
      setError(e?.message || 'Failed to load watch data')
    } finally {
      setLoading(false)
      isLoadDataRunningRef.current = false
    }
  }

  useEffect(() => {
    if (analysisOnly && !hideLiveOptions) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisOnly, hideLiveOptions])

  useEffect(() => {
    if (!analysisOnly || hideLiveOptions) return

    let active = true

    const loadCompletedGames = async () => {
      setReviewLoading(true)
      setReviewError('')

      try {
        const headers = {}
        const authValue = String(apiToken || getStoredApiToken() || '').trim()
        if (authValue) {
          headers.Authorization = `Bearer ${authValue}`
        }

        const response = await fetch('/api/game/completed?max=24', { headers })
        const payload = await response.json()

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to load completed games')
        }

        if (!active) return
        const rows = Array.isArray(payload?.data) ? payload.data : []
        const mapped = rows.map(completedToWatchGame)

        if (reviewIntent?.fen || reviewIntent?.moves?.length || reviewIntent?.gameId) {
          const intentMoveString = (Array.isArray(reviewIntent?.moves) ? reviewIntent.moves : [])
            .map((m) => {
              const from = String(m?.from || '')
              const to = String(m?.to || '')
              const promotion = String(m?.promotion || '').toLowerCase()
              if (!from || !to) return ''
              return `${from}${to}${promotion}`
            })
            .filter(Boolean)
            .join(' ')

          const intentGame = {
            id: String(reviewIntent?.gameId || 'review-intent'),
            status: String(reviewIntent?.result || '*'),
            winner: resultToWinner(reviewIntent?.result),
            ongoing: false,
            moves: intentMoveString,
            pgn: String(reviewIntent?.pgn || ''),
            initialFen: String(reviewIntent?.initialFen || new Chess().fen()),
            fen: String(reviewIntent?.fen || new Chess().fen()),
            opening: String(reviewIntent?.reason || 'Completed game'),
            white: String(reviewIntent?.whitePlayer || 'White'),
            black: String(reviewIntent?.blackPlayer || 'Black'),
            whiteEmail: String(reviewIntent?.whiteEmail || ''),
            blackEmail: String(reviewIntent?.blackEmail || ''),
            whiteRating: '-',
            blackRating: '-',
            whiteFed: '',
            blackFed: '',
            whiteTitle: '',
            blackTitle: '',
            url: '',
            endedAt: reviewIntent?.endedAt || null
          }

          const alreadyPresent = mapped.some((row) => String(row.id) === String(intentGame.id))
          if (!alreadyPresent) {
            mapped.unshift(intentGame)
          }
        }

        setTournamentGames(mapped)

        if (mapped.length) {
          const preferred = reviewIntent?.gameId
            ? mapped.find((row) => String(row.id) === String(reviewIntent.gameId))
            : null
          const first = preferred || mapped[0]
          setSelectedTournamentGame(first)
          appendLiveFen(first.id, first.fen)
          setTournamentPly(9999)
          setIsGameViewerOpen(true)
        } else {
          setSelectedTournamentGame({
            id: 'analysis-fallback',
            white: 'White',
            black: 'Black',
            whiteTitle: '',
            blackTitle: '',
            whiteFed: '',
            blackFed: '',
            whiteRating: '-',
            blackRating: '-',
            fen: new Chess().fen(),
            status: '*',
            opening: 'Start Position',
            ongoing: false,
            pgn: '',
            moves: ''
          })
          setIsGameViewerOpen(true)
        }

        if (reviewIntent) {
          clearReviewIntent()
        }
      } catch (error) {
        if (!active) return
        setReviewError(error?.message || 'Failed to load completed games')
      } finally {
        if (active) setReviewLoading(false)
      }
    }

    loadCompletedGames()
    return () => {
      active = false
    }
  }, [analysisOnly, hideLiveOptions, apiToken, reviewIntent, clearReviewIntent])

  useEffect(() => {
    let rafId = 0
    let observer = null

    const updateBoardSizes = () => {
      const viewportWidth = window.innerWidth || 1200
      const viewportHeight = window.innerHeight || 900
      const desktopSidebarWidth = viewportWidth >= 768 ? (collapsed ? 88 : 248) : 0
      const overlayOffset = mobileOpen && viewportWidth < 768 ? 248 : 0
      const usableWidth = Math.max(320, viewportWidth - desktopSidebarWidth - overlayOffset)
      // Use fixed breakpoints so board size does not pulse with panel/content changes.
      const targetByWidth =
        usableWidth >= 1800 ? 860
          : usableWidth >= 1600 ? 800
            : usableWidth >= 1440 ? 740
              : usableWidth >= 1280 ? 680
                : usableWidth >= 1100 ? 620
                  : usableWidth >= 900 ? 560
                    : Math.max(320, usableWidth - 56)

      const verticalChrome = analysisOnly ? 320 : 150
      const maxByHeight = Math.max(260, Math.floor(viewportHeight - verticalChrome))
      // Keep board size stable like lichess: derive from viewport + fixed side columns,
      // not from volatile container measurements that can change during analysis updates.
      const maxByLayout = usableWidth >= 1280
        ? Math.max(280, Math.floor(usableWidth - 240 - 430 - 120))
        : Math.max(280, Math.floor(usableWidth - 56))
      const main = Math.max(260, Math.min(targetByWidth, maxByHeight, maxByLayout))
      const thumb = Math.max(120, Math.min(190, Math.floor(main / 3.25)))

      if (Math.abs(main - boardWidthRef.current) >= 2) {
        boardWidthRef.current = main
        setBoardWidth(main)
      }

      if (Math.abs(thumb - thumbBoardWidthRef.current) >= 2) {
        thumbBoardWidthRef.current = thumb
        setThumbBoardWidth(thumb)
      }
    }

    const onResize = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
      rafId = requestAnimationFrame(updateBoardSizes)
    }

    onResize()
    window.addEventListener('resize', onResize)

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        onResize()
      })

      if (document?.body) {
        observer.observe(document.body)
      }
    }

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
      window.removeEventListener('resize', onResize)
      if (observer) {
        observer.disconnect()
      }
    }
  }, [isGameViewerOpen, analysisOnly, collapsed, mobileOpen])

  useEffect(() => {
    const id = setTimeout(() => {
      window.dispatchEvent(new Event('resize'))
    }, 320)

    return () => clearTimeout(id)
  }, [collapsed, mobileOpen])

  useEffect(() => {
    followLiveRef.current = followLive
  }, [followLive])

  useEffect(() => {
    if (!selectedTournamentGame) {
      setDisplayClocks({ white: null, black: null })
      return
    }
    const baseWhite = normalizeClockMs(selectedTournamentGame.whiteClock)
    const baseBlack = normalizeClockMs(selectedTournamentGame.blackClock)

    setDisplayClocks({
      white: baseWhite,
      black: baseBlack
    })
  }, [selectedTournamentGame?.id, selectedTournamentGame?.whiteClock, selectedTournamentGame?.blackClock])

  useEffect(() => {
    if (!isGameViewerOpen || !selectedTournamentGame?.ongoing || !followLive) return undefined

    const id = setInterval(() => {
      const liveFen = selectedTournamentGame?.fen || ''
      const sideToMove = (liveFen.split(' ')[1] || 'w') === 'w' ? 'white' : 'black'
      setDisplayClocks((prev) => {
        const current = prev[sideToMove]
        if (typeof current !== 'number' || current <= 0) return prev
        return {
          ...prev,
          [sideToMove]: Math.max(0, current - 1000)
        }
      })
    }, 1000)

    return () => clearInterval(id)
  }, [isGameViewerOpen, selectedTournamentGame?.ongoing, selectedTournamentGame?.fen, followLive])

  const tournamentReplay = useMemo(() => {
    try {
      if (hideLiveOptions) {
        const baseFen = learnHistory[0] || selectedTournamentGame?.initialFen || new Chess().fen()
        const replay = new Chess(baseFen)
        const fens = [replay.fen()]
        const verbose = []

        ;(learnMoves || []).forEach((mv) => {
          const from = String(mv?.from || '')
          const to = String(mv?.to || '')
          if (!from || !to) return
          const promotion = mv?.promotion ? String(mv.promotion).toLowerCase() : undefined
          const played = replay.move({ from, to, promotion })
          if (!played) return
          verbose.push(played)
          fens.push(replay.fen())
        })

        return {
          fens: learnHistory.length > 1 ? learnHistory : fens,
          moves: verbose
        }
      }

      const pgn = selectedTournamentGame?.pgn || ''
      const liveHistory = selectedTournamentGame?.id ? (liveFenHistoryByGame[selectedTournamentGame.id] || []) : []
      const emptyReplay = {
        fens: [new Chess().fen()],
        moves: []
      }

      if (selectedTournamentGame?.ongoing && liveHistory.length > 1) {
        let pgnMoves = []
        if (pgn) {
          const parsed = parsePgnReplay(pgn)
          pgnMoves = parsed?.moves || []
        }

        if (!pgnMoves.length) {
          const moveString = String(selectedTournamentGame?.moves || '').trim()
          if (moveString) {
            const replayFromMoves = selectedTournamentGame?.initialFen
              ? new Chess(selectedTournamentGame.initialFen)
              : new Chess()
            const uciMoves = moveString.split(/\s+/).filter(Boolean)
            const verbose = []

            uciMoves.forEach((uci) => {
              if (uci.length < 4) return
              const from = uci.slice(0, 2)
              const to = uci.slice(2, 4)
              const promotion = uci.length > 4 ? uci[4] : undefined
              const played = replayFromMoves.move({ from, to, promotion })
              if (!played) return
              verbose.push(played)
            })

            pgnMoves = verbose
          }
        }

        return {
          fens: liveHistory,
          moves: pgnMoves
        }
      }

      if (pgn) {
        const parsed = parsePgnReplay(pgn)
        if (parsed?.fens?.length) return parsed
      }

      if (liveHistory.length > 1) {
        return {
          fens: liveHistory,
          moves: []
        }
      }

      const moveString = String(selectedTournamentGame?.moves || '').trim()
      if (!moveString) {
        if (selectedTournamentGame?.fen) {
          return {
            fens: [selectedTournamentGame.fen],
            moves: []
          }
        }
        return emptyReplay
      }

      const replay = selectedTournamentGame?.initialFen
        ? new Chess(selectedTournamentGame.initialFen)
        : new Chess()
      const fens = [replay.fen()]
      const uciMoves = moveString.split(/\s+/).filter(Boolean)
      const verbose = []

      uciMoves.forEach((uci) => {
        if (uci.length < 4) return
        const from = uci.slice(0, 2)
        const to = uci.slice(2, 4)
        const promotion = uci.length > 4 ? uci[4] : undefined
        const played = replay.move({ from, to, promotion })
        if (!played) return
        verbose.push(played)
        fens.push(replay.fen())
      })

      if (!verbose.length) return emptyReplay
      return { fens, moves: verbose }
    } catch {
      return {
        fens: [new Chess().fen()],
        moves: []
      }
    }
  }, [hideLiveOptions, selectedTournamentGame, liveFenHistoryByGame, learnHistory, learnMoves])

  const tournamentMaxPly = Math.max(0, tournamentReplay.fens.length - 1)
  const clampedTournamentPly = Math.min(tournamentPly, tournamentMaxPly)
  const tournamentFen = tournamentReplay.fens[clampedTournamentPly] || new Chess().fen()
  const learnMaxPly = Math.max(0, learnHistory.length - 1)
  const clampedLearnPly = Math.min(learnPly, learnMaxPly)
  const activeBoardFen = hideLiveOptions ? (learnHistory[clampedLearnPly] || learnFen || tournamentFen) : tournamentFen
  const canUseMoveReplay = tournamentMaxPly > 0
  const shownWhiteClock = displayClocks.white ?? normalizeClockMs(selectedTournamentGame?.whiteClock)
  const shownBlackClock = displayClocks.black ?? normalizeClockMs(selectedTournamentGame?.blackClock)

  useEffect(() => {
    if (!activeBoardFen) return undefined
    if (!lastAnimatedFenRef.current) {
      lastAnimatedFenRef.current = activeBoardFen
      return undefined
    }
    if (lastAnimatedFenRef.current === activeBoardFen) return undefined

    lastAnimatedFenRef.current = activeBoardFen
    setIsBoardAnimating(true)
    const id = setTimeout(() => setIsBoardAnimating(false), 210)
    return () => clearTimeout(id)
  }, [activeBoardFen])

  useEffect(() => {
    if (!hideLiveOptions) return
    const nextId = String(selectedTournamentGame?.id || '')
    if (!nextId) return
    if (learnBaseGameIdRef.current === nextId) return

    learnBaseGameIdRef.current = nextId
    setLearnFen(tournamentFen)
    setLearnHistory([tournamentFen])
    setLearnMoves([])
    setLearnPly(0)
  }, [hideLiveOptions, selectedTournamentGame?.id])

  useEffect(() => {
    if (!followLive) return
    if (!selectedTournamentGame?.ongoing) return
    setTournamentPly(9999)
  }, [followLive, selectedTournamentGame?.id, selectedTournamentGame?.ongoing, tournamentMaxPly])

  const whiteEvaluation = useMemo(
    () => toWhitePerspectiveEval(evaluation, activeBoardFen),
    [evaluation, activeBoardFen]
  )

  const evalForWhite = useMemo(() => {
    if (!whiteEvaluation) return null
    if (whiteEvaluation.type === 'cp') {
      return Number(whiteEvaluation.value || 0) / 100
    }
    if (whiteEvaluation.type === 'mate') {
      return whiteEvaluation.value > 0 ? 12 : -12
    }
    return null
  }, [whiteEvaluation])

  const evalLabel = useMemo(() => {
    if (!whiteEvaluation) return '-'
    if (whiteEvaluation.type === 'mate') {
      const movesToMate = Math.max(1, Math.abs(Number(whiteEvaluation.value || 0)))
      return whiteEvaluation.value > 0 ? `#${movesToMate}` : `-#${movesToMate}`
    }
    const rawPawns = Number(displayEvalForWhite || 0)
    return `${rawPawns > 0 ? '+' : ''}${rawPawns.toFixed(1)}`
  }, [whiteEvaluation, displayEvalForWhite])

  const meVsBotGameState = useMemo(() => {
    if (!hideLiveOptions) {
      return { isOver: false, summary: '' }
    }

    try {
      const game = new Chess(activeBoardFen)
      if (!game.isGameOver()) {
        return { isOver: false, summary: '' }
      }

      if (game.isCheckmate()) {
        // In chess.js, turn() is the side to move (the mated side after mate).
        return game.turn() === 'b'
          ? { isOver: true, summary: 'Game over: You won by checkmate.' }
          : { isOver: true, summary: `Game over: ${selectedBot.name} won by checkmate.` }
      }

      if (game.isStalemate()) {
        return { isOver: true, summary: 'Game over: Draw by stalemate.' }
      }

      if (game.isThreefoldRepetition()) {
        return { isOver: true, summary: 'Game over: Draw by threefold repetition.' }
      }

      if (game.isInsufficientMaterial()) {
        return { isOver: true, summary: 'Game over: Draw by insufficient material.' }
      }

      if (game.isDraw()) {
        return { isOver: true, summary: 'Game over: Draw.' }
      }

      return { isOver: true, summary: 'Game over.' }
    } catch {
      return { isOver: false, summary: '' }
    }
  }, [hideLiveOptions, activeBoardFen, selectedBot.name])

  const canShowMeVsBotAnalysis = !hideLiveOptions || meVsBotAnalysisEnabled

  const formatWhiteEvalLabel = (normalizedEvaluation, fallback = '-') => {
    if (!normalizedEvaluation) return fallback
    if (normalizedEvaluation.type === 'mate') {
      const movesToMate = Math.max(1, Math.abs(Number(normalizedEvaluation.value || 0)))
      return normalizedEvaluation.value > 0 ? `#${movesToMate}` : `-#${movesToMate}`
    }
    const pawns = Number(normalizedEvaluation.value || 0) / 100
    return `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`
  }

  const cpToWinPercent = (cp) => {
    const x = Number.isFinite(cp) ? cp : 0
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * x)) - 1)
  }

  const evaluationToWhiteWinPercent = (normalizedEvaluation) => {
    if (!normalizedEvaluation) return 50
    if (normalizedEvaluation.type === 'mate') {
      if (normalizedEvaluation.value > 0) return 100
      if (normalizedEvaluation.value < 0) return 0
      return 50
    }
    return cpToWinPercent(Number(normalizedEvaluation.value || 0))
  }

  const computeLichessMoveAccuracy = (beforeWinPercent, afterWinPercent) => {
    const drop = Math.max(0, Number(beforeWinPercent || 0) - Number(afterWinPercent || 0))
    const raw = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669
    return Math.max(0, Math.min(100, raw))
  }

  const computeSideAccuracy = (rows, color) => {
    const own = rows.filter((row) => row.color === color)
    if (!own.length) return 0

    const moveAccuracies = own.map((row) => {
      const whiteBefore = evaluationToWhiteWinPercent(row.evalBefore)
      const whiteAfter = evaluationToWhiteWinPercent(row.evalAfter)

      const beforeForMover = color === 'w' ? whiteBefore : (100 - whiteBefore)
      const afterForMover = color === 'w' ? whiteAfter : (100 - whiteAfter)

      return computeLichessMoveAccuracy(beforeForMover, afterForMover)
    })

    const avg = moveAccuracies.reduce((sum, value) => sum + value, 0) / Math.max(1, moveAccuracies.length)
    return Number(avg.toFixed(1))
  }

  useEffect(() => {
    if (!whiteEvaluation || whiteEvaluation.type !== 'cp') return
    setDisplayEvalForWhite((prev) => {
      const base = Number.isFinite(prev) ? prev : 0
      const target = Number(whiteEvaluation.value || 0) / 100
      // Smooth large jumps so the bar feels stable during depth updates.
      return base + (target - base) * 0.32
    })
  }, [whiteEvaluation])

  const handleLearnPieceDrop = useCallback((sourceSquare, targetSquare, piece) => {
    if (!hideLiveOptions) return false

    const game = new Chess(activeBoardFen)
    if (game.turn() !== 'w') return false
    if (!String(piece || '').startsWith('w')) return false
    const isPawn = String(piece || '').toLowerCase().includes('p')
    const promotionRank = targetSquare?.[1]
    const promotion = isPawn && (promotionRank === '1' || promotionRank === '8') ? 'q' : undefined
    const move = game.move({ from: sourceSquare, to: targetSquare, promotion })
    if (!move) return false

    unlockAudio()
    setFollowLive(false)
    const playerFen = game.fen()
    setLearnFen(playerFen)
    setLearnHistory((prev) => {
      const base = prev.slice(0, clampedLearnPly + 1)
      return [...base, playerFen]
    })
    setLearnMoves((prev) => {
      const base = prev.slice(0, clampedLearnPly)
      return [...base, move]
    })
    setLearnPly((prev) => prev + 1)

    if (game.isGameOver() && !learnSessionRecordedRef.current) {
      const won = game.isCheckmate() ? game.turn() === 'b' : false
      learnSessionRecordedRef.current = true
      recordLearnSession({ botId: selectedBot.id, won, studyMinutes: 3 }).catch(() => {})
    }

    if (!game.isGameOver() && game.turn() === 'b') {
      const think = async () => {
        if (botThinkingRef.current) return
        botThinkingRef.current = true
        setBotThinking(true)

        try {
          const botGame = new Chess(playerFen)
          const legalMoves = botGame.moves({ verbose: true })
          if (!legalMoves.length) return

          let chosen = null
          const shouldInjectMistake = selectedBot.randomness > 0 && Math.random() < selectedBot.randomness
          if (engineReady) {
            try {
              const result = await analyzeFenAsync(botGame.fen(), selectedBot.depth)
              const best = String(result?.bestMove || '')
              const bestMove = legalMoves.find((m) => toMoveUci(m) === best) || null
              if (!bestMove) {
                chosen = null
              } else if (shouldInjectMistake) {
                const alternatives = legalMoves.filter((m) => toMoveUci(m) !== best)
                chosen = pickFallbackMove(alternatives) || bestMove
              } else {
                chosen = bestMove
              }
            } catch {
              chosen = null
            }
          }

          if (!chosen) {
            chosen = pickFallbackMove(legalMoves)
          }

          const played = botGame.move({
            from: chosen.from,
            to: chosen.to,
            promotion: chosen.promotion || 'q'
          })
          if (!played) return

          const botFen = botGame.fen()
          setLearnFen(botFen)
          setLearnHistory((prev) => [...prev, botFen])
          setLearnMoves((prev) => [...prev, played])
          setLearnPly((prev) => prev + 1)

          if (botGame.isGameOver() && !learnSessionRecordedRef.current) {
            const won = botGame.isCheckmate() ? botGame.turn() === 'b' : false
            learnSessionRecordedRef.current = true
            recordLearnSession({ botId: selectedBot.id, won, studyMinutes: 3 }).catch(() => {})
          }
        } catch {
          // Keep player position if bot move fails.
        } finally {
          botThinkingRef.current = false
          setBotThinking(false)
        }
      }

      setTimeout(think, 180)
    }
    return true
  }, [hideLiveOptions, activeBoardFen, clampedLearnPly, selectedBot, engineReady, analyzeFenAsync])

  useEffect(() => {
    const msUntilNextHour = 3600000 - (Date.now() % 3600000)
    avatarHourTimeoutRef.current = setTimeout(() => {
      setAvatarHourKey(Math.floor(Date.now() / 3600000))
      avatarHourIntervalRef.current = setInterval(() => {
        setAvatarHourKey(Math.floor(Date.now() / 3600000))
      }, 3600000)
    }, msUntilNextHour + 40)

    return () => {
      if (avatarHourTimeoutRef.current) {
        clearTimeout(avatarHourTimeoutRef.current)
        avatarHourTimeoutRef.current = null
      }
      if (avatarHourIntervalRef.current) {
        clearInterval(avatarHourIntervalRef.current)
        avatarHourIntervalRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!hideLiveOptions) return
    if (!selectedBot) return
    recordLearnProfile({ botId: selectedBot.id }).catch(() => {})
    setSkillLevel(selectedBot.skillLevel)
    setPowerMode(selectedBot.powerMode)
    setAnalysisDepth(selectedBot.depth)
  }, [hideLiveOptions, selectedBot, setSkillLevel, setPowerMode, setAnalysisDepth])

  useEffect(() => {
    if (!hideLiveOptions) return
    learnSessionRecordedRef.current = false
  }, [selectedTournamentGame?.id])

  useEffect(() => {
    if (!hideLiveOptions) return
    // Enable analysis by default for Me vs Bot mode (like Watch Live)
    setMeVsBotAnalysisEnabled(true)
  }, [hideLiveOptions, selectedTournamentGame?.id])

  const evalBarPercent = useMemo(() => {
    if (!whiteEvaluation) return 50

    if (whiteEvaluation.type === 'mate') {
      return whiteEvaluation.value > 0 ? 99 : 1
    }

    // Lichess winning chances mapping from centipawns.
    const pct = evaluationToWhiteWinPercent(whiteEvaluation)
    return Math.max(4, Math.min(96, pct))
  }, [whiteEvaluation])

  const boardDarkSquareStyle = useMemo(() => ({ backgroundColor: boardTheme.dark }), [boardTheme.dark])
  const boardLightSquareStyle = useMemo(() => ({ backgroundColor: boardTheme.light }), [boardTheme.light])

  const goFirst = () => {
    unlockAudio()
    if (hideLiveOptions) {
      setLearnPly(0)
      return
    }
    setFollowLive(false)
    setTournamentPly(0)
  }

  const goPrev = () => {
    unlockAudio()
    if (hideLiveOptions) {
      setLearnPly((p) => Math.max(0, p - 1))
      return
    }
    if (tournamentMaxPly <= 0) {
      setTournamentError('Moves are still loading for this game...')
      if (selectedTournamentGame) selectGame(selectedTournamentGame, false)
      return
    }
    setFollowLive(false)
    setTournamentPly(Math.max(0, clampedTournamentPly - 1))
  }

  const goNext = () => {
    unlockAudio()
    if (hideLiveOptions) {
      setLearnPly((p) => Math.min(learnMaxPly, p + 1))
      return
    }
    if (tournamentMaxPly <= 0) {
      setTournamentError('Moves are still loading for this game...')
      if (selectedTournamentGame) selectGame(selectedTournamentGame, false)
      return
    }
    setFollowLive(false)
    setTournamentPly(Math.min(tournamentMaxPly, clampedTournamentPly + 1))
  }

  const goLast = () => {
    unlockAudio()
    if (hideLiveOptions) {
      setLearnPly(learnMaxPly)
      return
    }
    setFollowLive(true)
    setTournamentPly(tournamentMaxPly)
  }

  const jumpToPly = (targetPly) => {
    unlockAudio()
    if (!Number.isFinite(targetPly)) return
    if (hideLiveOptions) {
      const clamped = Math.max(0, Math.min(learnMaxPly, Math.floor(targetPly)))
      setLearnPly(clamped)
      return
    }
    const clamped = Math.max(0, Math.min(tournamentMaxPly, Math.floor(targetPly)))
    setFollowLive(false)
    setTournamentPly(clamped)
  }

  const moveRows = useMemo(() => {
    const rows = []
    const moves = tournamentReplay.moves || []
    for (let i = 0; i < moves.length; i += 2) {
      rows.push({
        move: Math.floor(i / 2) + 1,
        white: moves[i]?.san || '-',
        black: moves[i + 1]?.san || ''
      })
    }
    return rows
  }, [tournamentReplay])

  const activeReplayPly = hideLiveOptions ? clampedLearnPly : clampedTournamentPly

  const qualityByPly = useMemo(() => {
    const map = new Map()
    qualityRows.forEach((row) => map.set(row.ply, row))
    return map
  }, [qualityRows])
  const graphRows = useMemo(() => {
    const moves = tournamentReplay.moves || []
    if (!moves.length) return []

    let lastEval = null
    return moves.map((move, idx) => {
      const ply = idx + 1
      const analyzed = qualityByPly.get(ply)
      if (analyzed) {
        lastEval = analyzed.evalAfter || lastEval
        return analyzed
      }

      // Keep graph continuity even when a ply is not fully analyzed yet.
      return {
        ply,
        color: move?.color || (ply % 2 === 1 ? 'w' : 'b'),
        san: move?.san || '',
        classification: '',
        evalAfter: lastEval,
        lossCp: 0
      }
    })
  }, [tournamentReplay.moves, qualityByPly])

  const activeQualityRow = useMemo(
    () => qualityByPly.get(activeReplayPly) || null,
    [qualityByPly, activeReplayPly]
  )

  const boardSquareStyles = useMemo(() => {
    const styles = {}
    const activeQRow = activeQualityRow
    if (activeQRow?.playedMoveUci) {
      const from = activeQRow.playedMoveUci.slice(0, 2)
      const to = activeQRow.playedMoveUci.slice(2, 4)
      if (from) {
        styles[from] = classificationSquareStyle(activeQRow.classification)
      }
      if (to) {
        styles[to] = classificationSquareStyle(activeQRow.classification)
      }
    }
    try {
      const g = new Chess(activeBoardFen)
      if (g.isCheck()) {
        const t = g.turn()
        const bd = g.board()
        for (let rr = 0; rr < 8; rr++) {
          for (let ff = 0; ff < 8; ff++) {
            const p = bd[rr][ff]
            if (p && p.type === 'k' && p.color === t) {
              styles[String.fromCharCode(97 + ff) + (8 - rr)] = checkSquareStyle()
            }
          }
        }
      }
    } catch {
      // Ignore board parsing issues for styling.
    }
    return styles
  }, [activeQualityRow, activeBoardFen])

  const engineArrows = useMemo(() => {
    const arrowColors = ['rgb(0,200,80)', 'rgb(30,144,255)', 'rgb(160,160,180)']
    const arrows = []

    ;(pvLines || []).slice(0, 2).forEach((line, i) => {
      const uci = line?.bestMove || ''
      if (uci.length < 4) return
      const from = uci.slice(0, 2)
      const to = uci.slice(2, 4)
      arrows.push([from, to, arrowColors[i] || arrowColors[2]])
    })

    // Always keep at least one visible engine arrow.
    if (!arrows.length) {
      const fallbackUci = (bestMove && bestMove.length >= 4)
        ? bestMove
        : ''
      if (fallbackUci.length >= 4) {
        const from = fallbackUci.slice(0, 2)
        const to = fallbackUci.slice(2, 4)
        arrows.push([from, to, arrowColors[0]])
      }
    }

    return arrows
  }, [pvLines, bestMove])

  const displayPvLines = useMemo(() => {
    const sourceLines = hideLiveOptions && meVsBotGameState.isOver
      ? (pvLines || [])
      : (pvLines || []).slice(0, 3)

    return sourceLines.map((line) => {
      if (!line) return null
      const normalizedEval = toWhitePerspectiveEval(line, activeBoardFen)
      return {
        ...line,
        evalLabel: formatWhiteEvalLabel(normalizedEval, '-')
      }
    })
  }, [pvLines, activeBoardFen, hideLiveOptions, meVsBotGameState.isOver])

  useEffect(() => {
    const normalizedArrows = engineArrows.length >= 3
      ? engineArrows.slice(0, 3)
      : engineArrows.length >= 2
        ? engineArrows.slice(0, 2)
        : engineArrows.slice(0, 1)

    if (isAnalyzing) {
      // Keep arrows fixed while the engine is still searching to avoid board jitter.
      return undefined
    }

    const timer = setTimeout(() => {
      setDisplayEngineArrows((prev) => {
        if (!normalizedArrows.length) return prev

        const same = prev.length === normalizedArrows.length
          && prev.every((arrow, idx) => arrow[0] === normalizedArrows[idx][0] && arrow[1] === normalizedArrows[idx][1])
        if (same) return prev

        // Keep 2/3-arrow stability during transient engine fluctuations.
        if (isAnalyzing && normalizedArrows.length === 1 && (prev.length === 2 || prev.length === 3)) {
          return prev
        }

        return normalizedArrows
      })
    }, 200)

    return () => clearTimeout(timer)
  }, [engineArrows, isAnalyzing])

  const whiteAccuracy = useMemo(() => computeSideAccuracy(qualityRows, 'w'), [qualityRows])
  const blackAccuracy = useMemo(() => computeSideAccuracy(qualityRows, 'b'), [qualityRows])
  const showEvalBar = !hideLiveOptions || canShowMeVsBotAnalysis
  const evalColumnWidth = useMemo(() => {
    if (!showEvalBar) return 0
    return Math.max(58, Math.min(78, Math.round(boardWidth * 0.12)))
  }, [showEvalBar, boardWidth])
  const evalTrackWidth = useMemo(
    () => Math.max(24, Math.min(32, Math.round(evalColumnWidth * 0.44))),
    [evalColumnWidth]
  )
  const boardSquareStylesForRender = useMemo(
    () => (isBoardAnimating ? {} : boardSquareStyles),
    [isBoardAnimating, boardSquareStyles]
  )
  const boardArrows = useMemo(() => {
    if (!canShowMeVsBotAnalysis || isAnalyzing || isBoardAnimating) return []
    return displayEngineArrows.slice(0, 1)
  }, [canShowMeVsBotAnalysis, isAnalyzing, isBoardAnimating, displayEngineArrows])

  const qualityGraphData = useMemo(() => {
    const W = 680
    const H = 120
    const padL = 4
    const padR = 4
    const padT = 6
    const padB = 6
    const innerW = W - padL - padR
    const innerH = H - padT - padB
    const midY = padT + innerH / 2

    if (!graphRows.length) {
      return { points: [], linePath: '', whiteArea: '', blackArea: '', W, H, midY, padL, padR, padT, padB, innerW, innerH }
    }

    const len = graphRows.length
    let lastCp = 0
    const points = graphRows.map((row, i) => {
      const cp = row?.evalAfter ? evalToCentipawnsWhite(row.evalAfter) : lastCp
      lastCp = cp
      const winPercent = evaluationToWhiteWinPercent(row?.evalAfter || { type: 'cp', value: cp })
      const x = padL + (i / Math.max(1, len - 1)) * innerW
      const y = padT + ((100 - winPercent) / 100) * innerH
      return { x: +x.toFixed(2), y: +y.toFixed(2), row, i }
    })

    // Build a smooth SVG path using cubic bezier spline
    const buildSmoothPath = (pts) => {
      if (!pts.length) return ''
      if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`
      let d = `M ${pts[0].x},${pts[0].y}`
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1]
        const curr = pts[i]
        const cpx = (prev.x + curr.x) / 2
        d += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`
      }
      return d
    }

    const linePath = buildSmoothPath(points)
    const first = points[0]
    const last = points[points.length - 1]

    // Area under curve down to chart floor (matches compact review-chart style).
    const areaPath = (pts) => {
      if (!pts.length) return ''
      const baseY = H - padB
      let d = `M ${pts[0].x},${baseY}`
      d += ` L ${pts[0].x},${pts[0].y}`
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1]
        const curr = pts[i]
        const cpx = (prev.x + curr.x) / 2
        d += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`
      }
      d += ` L ${last.x},${baseY} Z`
      return d
    }

    const fullArea = areaPath(points)

    return { points, linePath, fullArea, W, H, midY, padL, padR, padT, padB, innerW, innerH }
  }, [graphRows])

  const runQualityReview = async () => {
    if (!engineReady || !selectedTournamentGame || !tournamentReplay.moves?.length) {
      console.log('[Quality Review] Early exit - engineReady:', engineReady, 'game:', !!selectedTournamentGame, 'moves:', tournamentReplay.moves?.length)
      return
    }

    const rawStartFen = tournamentReplay.fens?.[0] || selectedTournamentGame.initialFen || new Chess().fen()
    let replay
    try {
      replay = new Chess(rawStartFen)
    } catch {
      console.log('[Quality Review] Invalid starting FEN, using default')
      replay = new Chess()
    }

    const moves = tournamentReplay.moves || []
    setQualityError('')
    setQualityRows([])
    setQualityRunning(true)
    setQualityProgress({ current: 0, total: moves.length })

    console.log('[Quality Review] Starting analysis of', moves.length, 'moves')

    const rows = []

    try {
      for (let i = 0; i < moves.length; i += 1) {
        const move = moves[i]
        const fenBefore = replay.fen()
        
        let before
        try {
          before = await analyzeFenAsync(fenBefore, analysisDepth)
        } catch (e) {
          console.error('[Quality Review] Error analyzing position before move', i + 1, e)
          throw e
        }

        const played = replay.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion || 'q'
        })

        if (!played) {
          throw new Error(`Invalid move encountered at ply ${i + 1}`)
        }

        const fenAfter = replay.fen()
        
        let after
        try {
          after = await analyzeFenAsync(fenAfter, analysisDepth)
        } catch (e) {
          console.error('[Quality Review] Error analyzing position after move', i + 1, e)
          throw e
        }
        
        const playedMoveUci = toMoveUci(move)
        const beforeEvalWhite = toWhitePerspectiveEval(before.evaluation, fenBefore)
        const afterEvalWhite = toWhitePerspectiveEval(after.evaluation, fenAfter)

        const classification = classifyWatchMove({
          playedMoveUci,
          bestMoveUci: before.bestMove,
          evalBefore: beforeEvalWhite,
          evalAfter: afterEvalWhite,
          moveColor: move.color,
          ply: i + 1
        })

        rows.push({
          ply: i + 1,
          moveNumber: Math.floor(i / 2) + 1,
          color: move.color,
          san: move.san,
          playedMoveUci,
          bestMoveUci: before.bestMove,
          evalBefore: beforeEvalWhite,
          evalAfter: afterEvalWhite,
          classification: classification.label,
          lossCp: classification.lossCp
        })

        setQualityRows([...rows])
        setQualityProgress({ current: i + 1, total: moves.length })
      }
      
      console.log('[Quality Review] Analysis complete:', rows.length, 'moves analyzed')
      await detectOpeningForCurrentGame(rows)
    } catch (e) {
      console.error('[Quality Review] Caught error during analysis:', e)
      if (isExpectedAnalysisCancel(e)) {
        setQualityError('')
        // Let auto-review run again after engine finishes reconfiguration.
        lastAutoQualityKeyRef.current = ''
        return
      }
      setQualityError(e?.message || 'Failed to analyze move quality for this game')
    } finally {
      setQualityRunning(false)
    }
  }

  const detectOpeningForCurrentGame = async (analysisRows = []) => {
    if (!selectedTournamentGame || !(tournamentReplay.moves || []).length) {
      setDetectedOpening({ name: '', eco: '' })
      return
    }

    try {
      setDetectingOpening(true)

      const movesSan = (tournamentReplay.moves || []).map((m) => String(m?.san || m?.move || '')).filter(Boolean)
      if (!movesSan.length) {
        setDetectedOpening({ name: '', eco: '' })
        return
      }

      let evaluations = []
      if (Array.isArray(analysisRows) && analysisRows.length === movesSan.length) {
        evaluations = [analysisRows[0]?.evalBefore, ...analysisRows.map((r) => r?.evalAfter)]
      } else {
        evaluations = new Array(movesSan.length + 1).fill(0)
      }

      const payload = {
        pgn: selectedTournamentGame?.pgn || '',
        moves: movesSan,
        evaluations
      }

      const data = await analyzeEngineDeterministic(payload)
      setDetectedOpening({
        name: String(data?.opening?.name || ''),
        eco: String(data?.opening?.eco || '')
      })
    } catch {
      setDetectedOpening({ name: '', eco: '' })
    } finally {
      setDetectingOpening(false)
    }
  }

  const loadTournamentGames = async (tournament) => {
    if (!tournament?.id) return

    const showBlockingLoader = tournamentGames.length === 0
    setFollowLive(true)
    setSelectedTournament(tournament)
    setSelectedBroadcast(null)
    setSelectedBroadcastRound(null)
    setTournamentLoading(showBlockingLoader)
    setTournamentError('')

    try {
      const data = await fetchLichessTournamentGames(tournament.id, 12)
      const games = data.games || []
      const liveGames = games.filter((g) => g.ongoing)
      const prioritizedGames = [...liveGames, ...games.filter((g) => !g.ongoing)]

      applyIncomingLiveGames(prioritizedGames)
      if (!prioritizedGames.length) {
        setTournamentError('No games returned for this tournament yet.')
      } else if (!liveGames.length) {
        setTournamentError('No live games in this tournament right now. Showing latest completed games.')
      }
    } catch (e) {
      setTournamentError(e?.message || 'Failed to load tournament games')
    } finally {
      setTournamentLoading(false)
    }
  }

  const loadBroadcastRound = async (broadcast, roundId) => {
    if (!roundId) return

    const showBlockingLoader = tournamentGames.length === 0
    setFollowLive(true)
    setSelectedBroadcast(broadcast)
    setExpandedBroadcastId(String(broadcast?.id || ''))
    setSelectedBroadcastRound(roundId)
    setSelectedTournament(null)
    setTournamentLoading(showBlockingLoader)
    setTournamentError('')

    try {
      const data = await fetchLichessBroadcastRound(roundId)
      const games = (data?.games || []).map((g) => ({
        ...g,
        opening: data?.tour?.name || broadcast?.name || 'Broadcast'
      }))
      const liveGames = games.filter((g) => g.ongoing)
      const prioritizedGames = [...liveGames, ...games.filter((g) => !g.ongoing)]
      applyIncomingLiveGames(prioritizedGames)

      if (!prioritizedGames.length) {
        setTournamentError('No games in this broadcast round yet.')
      }
    } catch (e) {
      setTournamentError(e?.message || 'Failed to load broadcast round')
    } finally {
      setTournamentLoading(false)
    }
  }

  const applyIncomingLiveGames = (incomingGames = []) => {
    const liveGames = incomingGames.filter((g) => g.ongoing)
    const prioritizedGames = [...liveGames, ...incomingGames.filter((g) => !g.ongoing)]

    setTournamentGames((prevGames) => {
      const mergedGames = mergeEnrichedGames(prioritizedGames, prevGames)
      mergedGames.forEach((g) => appendLiveFen(g.id, g.fen))

      if (!mergedGames.length) {
        setSelectedTournamentGame(null)
        return mergedGames
      }

      setSelectedTournamentGame((prevSelected) => {
        if (!prevSelected?.id) {
          setTournamentPly(9999)
          return pickBestGame(mergedGames)
        }

        const same = mergedGames.find((g) => g.id === prevSelected.id)
        if (!same) {
          setTournamentPly(0)
          return pickBestGame(mergedGames)
        }

        if (followLiveRef.current && same.ongoing) {
          setTournamentPly(9999)
        }

        return {
          ...same,
          pgn: same.pgn || prevSelected.pgn || '',
          moves: same.moves || prevSelected.moves || ''
        }
      })

      return mergedGames
    })

    setTournamentLoading(false)
    setTournamentError('')
    setTournamentLastUpdated(new Date())
  }


  useEffect(() => {
    if (!tournamentAutoPlay) return undefined
    if (!canUseMoveReplay) return undefined

    const id = setInterval(() => {
      setTournamentPly((p) => {
        if (p >= tournamentMaxPly) return 0
        return p + 1
      })
    }, 900)

    return () => clearInterval(id)
  }, [tournamentAutoPlay, tournamentMaxPly, canUseMoveReplay])

  useEffect(() => {
    if (!socket) return undefined
    if (!selectedTournament?.id) return undefined

    const sourceType = 'tournament'
    const sourceId = selectedTournament.id
    socket.emit('watch:subscribe', { sourceType, sourceId })

    return () => {
      socket.emit('watch:unsubscribe', { sourceType, sourceId })
    }
  }, [socket, selectedTournament?.id])

  useEffect(() => {
    if (!socket) return undefined
    if (!selectedBroadcastRound) return undefined

    const sourceType = 'broadcast-round'
    const sourceId = selectedBroadcastRound
    socket.emit('watch:subscribe', { sourceType, sourceId })

    return () => {
      socket.emit('watch:unsubscribe', { sourceType, sourceId })
    }
  }, [socket, selectedBroadcastRound])

  useEffect(() => {
    if (!socket) return undefined

    const handleWatchUpdate = (payload) => {
      if (!payload?.sourceType || !payload?.sourceId) return

      if (payload.sourceType === 'tournament' && payload.sourceId === selectedTournament?.id) {
        lastWatchUpdateRef.current = Date.now()
        applyIncomingLiveGames(payload.games || [])
        return
      }

      if (payload.sourceType === 'broadcast-round' && payload.sourceId === selectedBroadcastRound) {
        lastWatchUpdateRef.current = Date.now()
        applyIncomingLiveGames(payload.games || [])
      }
    }

    const handleWatchError = (payload) => {
      if (!payload?.sourceType || !payload?.sourceId) return

      if (payload.sourceType === 'tournament' && payload.sourceId === selectedTournament?.id) {
        setTournamentError(payload.message || 'Live update failed for this tournament.')
        return
      }

      if (payload.sourceType === 'broadcast-round' && payload.sourceId === selectedBroadcastRound) {
        setTournamentError(payload.message || 'Live update failed for this broadcast round.')
      }
    }

    socket.on('watch:games-update', handleWatchUpdate)
    socket.on('watch:error', handleWatchError)

    return () => {
      socket.off('watch:games-update', handleWatchUpdate)
      socket.off('watch:error', handleWatchError)
    }
  }, [socket, selectedTournament?.id, selectedBroadcastRound])

  useEffect(() => {
    if (!selectedTournament?.id) return undefined

    const id = setInterval(async () => {
      const hasFreshSocket = socket?.connected && (Date.now() - lastWatchUpdateRef.current < 6000)
      if (hasFreshSocket) return

      try {
        const data = await fetchLichessTournamentGames(selectedTournament.id, 12)
        const games = data.games || []
        const liveGames = games.filter((g) => g.ongoing)
        const prioritizedGames = [...liveGames, ...games.filter((g) => !g.ongoing)]

        setTournamentGames((prevGames) => {
          const mergedGames = mergeEnrichedGames(prioritizedGames, prevGames)
          mergedGames.forEach((g) => appendLiveFen(g.id, g.fen))

          if (!mergedGames.length || !selectedTournamentGame?.id) {
            return mergedGames
          }

          const same = mergedGames.find((g) => g.id === selectedTournamentGame.id)
          if (same) {
            setSelectedTournamentGame((prevSelected) => {
              if (!prevSelected || prevSelected.id !== same.id) return same
              return {
                ...same,
                pgn: same.pgn || prevSelected.pgn || '',
                moves: same.moves || prevSelected.moves || ''
              }
            })
            appendLiveFen(same.id, same.fen)
          } else {
            setSelectedTournamentGame(pickBestGame(mergedGames))
            setTournamentPly(0)
          }

          return mergedGames
        })
        setTournamentLastUpdated(new Date())
      } catch {
        // Keep current view if polling fails.
      }
    }, 10000)

    return () => clearInterval(id)
  }, [socket, selectedTournament, selectedTournamentGame])

  useEffect(() => {
    if (!selectedBroadcastRound) return undefined

    const id = setInterval(async () => {
      const hasFreshSocket = socket?.connected && (Date.now() - lastWatchUpdateRef.current < 6000)
      if (hasFreshSocket) return

      try {
        const data = await fetchLichessBroadcastRound(selectedBroadcastRound)
        const games = (data?.games || []).map((g) => ({
          ...g,
          opening: data?.tour?.name || selectedBroadcast?.name || 'Broadcast'
        }))
        const liveGames = games.filter((g) => g.ongoing)
        const prioritizedGames = [...liveGames, ...games.filter((g) => !g.ongoing)]
        setTournamentGames((prevGames) => {
          const mergedGames = mergeEnrichedGames(prioritizedGames, prevGames)
          mergedGames.forEach((g) => appendLiveFen(g.id, g.fen))

          if (!mergedGames.length || !selectedTournamentGame?.id) {
            return mergedGames
          }

          const same = mergedGames.find((g) => g.id === selectedTournamentGame.id)
          if (same) {
            setSelectedTournamentGame((prevSelected) => {
              if (!prevSelected || prevSelected.id !== same.id) return same
              return {
                ...same,
                pgn: same.pgn || prevSelected.pgn || '',
                moves: same.moves || prevSelected.moves || ''
              }
            })
            appendLiveFen(same.id, same.fen)
          }

          return mergedGames
        })
        setTournamentLastUpdated(new Date())
      } catch {
        // Keep current board if polling fails.
      }
    }, 10000)

    return () => clearInterval(id)
  }, [socket, selectedBroadcastRound, selectedBroadcast, selectedTournamentGame])

  useEffect(() => {
    if (!isGameViewerOpen || !selectedBroadcastRound || !selectedTournamentGame?.id || !selectedTournamentGame?.ongoing) {
      return undefined
    }

    const id = setInterval(async () => {
      const hasFreshSocket = socket?.connected && (Date.now() - lastWatchUpdateRef.current < 3500)
      if (hasFreshSocket) return

      try {
        const data = await fetchLichessBroadcastRound(selectedBroadcastRound)
        const liveGames = (data?.games || []).map((g) => ({
          ...g,
          opening: data?.tour?.name || selectedBroadcast?.name || 'Broadcast'
        }))

        const liveCurrent = liveGames.find((g) => g.id === selectedTournamentGame.id)
        if (!liveCurrent) return

        setSelectedTournamentGame((prev) => {
          if (!prev || prev.id !== liveCurrent.id) return prev
          return {
            ...prev,
            ...liveCurrent,
            pgn: prev.pgn || liveCurrent.pgn || '',
            moves: prev.moves || liveCurrent.moves || ''
          }
        })

        setTournamentGames((prev) => prev.map((g) => {
          if (g.id !== liveCurrent.id) return g
          return {
            ...g,
            ...liveCurrent,
            pgn: g.pgn || liveCurrent.pgn || '',
            moves: g.moves || liveCurrent.moves || ''
          }
        }))

        appendLiveFen(liveCurrent.id, liveCurrent.fen)
        setTournamentLastUpdated(new Date())
      } catch {
        // Keep current snapshot if fast live refresh fails.
      }
    }, 2000)

    return () => clearInterval(id)
  }, [socket, isGameViewerOpen, selectedBroadcastRound, selectedBroadcast, selectedTournamentGame?.id, selectedTournamentGame?.ongoing])

  useEffect(() => {
    if (qualityRunning) return undefined
    if (!isGameViewerOpen || !selectedTournamentGame?.id || !activeBoardFen || !engineReady) return undefined

    if (hideLiveOptions && !canShowMeVsBotAnalysis) return undefined

    // In Me vs Bot, avoid clashing with the bot's async search while still
    // keeping eval bar synced to the visible board position.
    const activeTurn = String(activeBoardFen || '').split(' ')[1] || 'w'
    if (hideLiveOptions && canShowMeVsBotAnalysis && !meVsBotGameState.isOver && (botThinking || activeTurn === 'b')) return undefined

    const targetDepth = hideLiveOptions && canShowMeVsBotAnalysis
      ? Math.max(24, analysisDepth)
      : analysisDepth

    const analysisKey = `${selectedTournamentGame.id}|${activeBoardFen}|${nnueMode ? 'nnue' : 'classic'}|${selectedNnueNetworkId}|d${targetDepth}`
    if (lastAnalysisKeyRef.current === analysisKey) return undefined

    if (analysisDebounceRef.current) {
      clearTimeout(analysisDebounceRef.current)
    }

    analysisDebounceRef.current = setTimeout(() => {
      lastAnalysisKeyRef.current = analysisKey
      analyzeFen(activeBoardFen, targetDepth)
    }, 260)

    return () => {
      if (analysisDebounceRef.current) {
        clearTimeout(analysisDebounceRef.current)
      }
    }
  }, [qualityRunning, hideLiveOptions, canShowMeVsBotAnalysis, botThinking, meVsBotGameState.isOver, isGameViewerOpen, selectedTournamentGame?.id, activeBoardFen, engineReady, nnueMode, selectedNnueNetworkId, analyzeFen, analysisDepth])

  useEffect(() => {
    if (!isGameViewerOpen || !selectedTournamentGame?.id) return

    if (lastPlySoundRef.current === null) {
      lastPlySoundRef.current = clampedTournamentPly
      return
    }

    if (clampedTournamentPly === lastPlySoundRef.current) return
    if (clampedTournamentPly <= 0) {
      lastPlySoundRef.current = clampedTournamentPly
      return
    }

    const move = tournamentReplay.moves?.[clampedTournamentPly - 1]
    const san = String(move?.san || '')

    if (move?.promotion || san.includes('=')) {
      playPromotion()
    } else if (san === 'O-O' || san === 'O-O-O') {
      playCastle()
    } else if (move?.captured || san.includes('x')) {
      playCapture()
    } else {
      playMove()
    }

    lastPlySoundRef.current = clampedTournamentPly
  }, [isGameViewerOpen, selectedTournamentGame?.id, clampedTournamentPly, tournamentReplay.moves, activeBoardFen, tournamentMaxPly, playMove, playCapture, playCastle, playCheck, playPromotion, playGameEnd])

  useEffect(() => {
    setQualityRows([])
    setQualityError('')
    setQualityProgress({ current: 0, total: 0 })
    setQualityRunning(false)
    lastAutoQualityKeyRef.current = ''
  }, [selectedTournamentGame?.id])

  useEffect(() => {
    if (!isGameViewerOpen) return
    if (!engineReady) return
    if (qualityRunning) return
    if (!selectedTournamentGame?.id) return

    const moveCount = tournamentReplay.moves?.length || 0
    if (moveCount <= 0) return

    const autoKey = `${selectedTournamentGame.id}|${moveCount}`
    if (lastAutoQualityKeyRef.current === autoKey) {
      console.log('[Quality Analysis] Skipping duplicate analysis for key:', autoKey)
      return
    }

    console.log('[Quality Analysis] Starting auto-run for game:', selectedTournamentGame.id, 'moves:', moveCount)
    lastAutoQualityKeyRef.current = autoKey
    runQualityReview()
  }, [isGameViewerOpen, engineReady, qualityRunning, selectedTournamentGame?.id, tournamentReplay])

  useEffect(() => {
    if (!analysisOnly || hideLiveOptions) return
    if (selectedTournamentGame || tournamentGames.length === 0) return

    const best = pickBestGame(tournamentGames)
    if (best) {
      selectGame(best, false)
    }
  }, [analysisOnly, hideLiveOptions, tournamentGames, selectedTournamentGame])

  useEffect(() => {
    if (analysisOnly && !hideLiveOptions) return
    if (!analysisOnly) {
      analysisBootstrapRef.current = false
      return
    }

    if (hideLiveOptions) {
      if (!selectedTournamentGame || !String(selectedTournamentGame.id || '').startsWith('learn-bot')) {
        const startFen = new Chess().fen()
        setSelectedTournamentGame({
          id: 'learn-bot',
          white: 'You',
          black: selectedBot.name,
          whiteTitle: '',
          blackTitle: 'BOT',
          whiteFed: '',
          blackFed: '',
          whiteRating: '-',
          blackRating: String(selectedBot.rating),
          fen: startFen,
          status: '*',
          opening: 'Me vs Bot',
          ongoing: false,
          pgn: '',
          moves: ''
        })
      }
      analysisBootstrapRef.current = true
      if (!isGameViewerOpen) setIsGameViewerOpen(true)
      return
    }

    if (analysisBootstrapRef.current) return
    if (loading || tournamentLoading) return

    if (!selectedTournamentGame && tournamentGames.length > 0) {
      const best = pickBestGame(tournamentGames)
      if (best) {
        analysisBootstrapRef.current = true
        selectGame(best, false)
      }
      return
    }

    if (!selectedBroadcastRound && broadcasts.length > 0) {
      const firstBroadcast = broadcasts[0]
      const activeRound = firstBroadcast?.rounds?.find((r) => r.id === firstBroadcast?.activeRoundId) || firstBroadcast?.rounds?.[0]
      if (firstBroadcast && activeRound?.id) {
        analysisBootstrapRef.current = true
        loadBroadcastRound(firstBroadcast, activeRound.id)
        return
      }
    }

    if (!selectedTournament && tournaments.length > 0) {
      analysisBootstrapRef.current = true
      loadTournamentGames(tournaments[0])
      return
    }

    if (!selectedTournamentGame && tournaments.length === 0 && broadcasts.length === 0 && !error) {
      analysisBootstrapRef.current = true
      setSelectedTournamentGame({
        id: 'analysis-fallback',
        white: 'White',
        black: 'Black',
        whiteTitle: '',
        blackTitle: '',
        whiteFed: '',
        blackFed: '',
        whiteRating: '-',
        blackRating: '-',
        fen: new Chess().fen(),
        status: '*',
        opening: 'Start Position',
        ongoing: false,
        pgn: '',
        moves: ''
      })
      setIsGameViewerOpen(true)
    }
  }, [analysisOnly, hideLiveOptions, isGameViewerOpen, selectedBot, loading, tournamentLoading, selectedTournamentGame, tournamentGames, selectedTournament, tournaments, selectedBroadcastRound, broadcasts, error])

  useEffect(() => {
    if (analysisOnly || hideLiveOptions) return
    if (loading || tournamentLoading) return
    if (selectedTournament || selectedBroadcastRound) return
    if (!Array.isArray(broadcasts) || broadcasts.length === 0) return

    const firstBroadcast = broadcasts[0]
    const activeRound = firstBroadcast?.rounds?.find((row) => row.id === firstBroadcast?.activeRoundId) || firstBroadcast?.rounds?.[0]
    if (!firstBroadcast || !activeRound?.id) return

    loadBroadcastRound(firstBroadcast, activeRound.id)
  }, [analysisOnly, hideLiveOptions, loading, tournamentLoading, selectedTournament, selectedBroadcastRound, broadcasts])

  const replayMoveCount = (tournamentReplay.moves || []).length

  const showLiveTournamentStream = useMemo(() => {
    if (analysisOnly || hideLiveOptions) return false
    if (!selectedTournamentGame?.ongoing) return false
    return Boolean(selectedTournament || selectedBroadcastRound)
  }, [analysisOnly, hideLiveOptions, selectedTournamentGame?.ongoing, selectedTournament, selectedBroadcastRound])

  const normalizeStreamText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

  const tokenizeForStreamMatch = (value) => {
    const raw = normalizeStreamText(value)
    if (!raw) return []
    return raw
      .split(' ')
      .map((part) => part.trim())
      .filter((part) => part.length >= 3)
  }

  const scoreTokenMatch = (haystack, token) => {
    const cleanToken = String(token || '').trim()
    if (!cleanToken || cleanToken.length < 3) return 0
    if (haystack.includes(cleanToken)) return 1

    // Handle minor transliteration/inflection differences without opening broad matches.
    if (cleanToken.length >= 5 && haystack.includes(cleanToken.slice(1))) return 0.85
    if (cleanToken.length >= 5 && haystack.includes(cleanToken.slice(0, -1))) return 0.8
    if (cleanToken.length >= 6 && haystack.includes(cleanToken.slice(-4))) return 0.72

    return 0
  }

  const bestTokenScore = (haystack, tokens = []) => {
    if (!tokens.length) return 0
    let best = 0
    for (const token of tokens) {
      best = Math.max(best, scoreTokenMatch(haystack, token))
      if (best >= 1) break
    }
    return best
  }

  const contextualLiveStreamers = useMemo(() => {
    if (!showLiveTournamentStream || !selectedTournamentGame) return []

    const tournamentName = selectedBroadcast?.name
      || selectedTournament?.fullName
      || selectedTournament?.name
      || selectedTournamentGame?.opening
      || ''
    const whiteName = displayName(selectedTournamentGame?.white)
    const blackName = displayName(selectedTournamentGame?.black)

    const tournamentTokens = tokenizeForStreamMatch(tournamentName)
    const whiteTokens = tokenizeForStreamMatch(whiteName)
    const blackTokens = tokenizeForStreamMatch(blackName)

    if (!tournamentTokens.length || (!whiteTokens.length && !blackTokens.length)) {
      return []
    }

    const scored = liveStreamers
      .map((streamer) => {
        const haystack = normalizeStreamText([
          streamer?.title,
          streamer?.headline,
          streamer?.stream?.status,
          streamer?.name,
          streamer?.stream?.url
        ].filter(Boolean).join(' '))

        const tournamentHits = tournamentTokens.filter((token) => haystack.includes(token)).length
        const whiteScore = bestTokenScore(haystack, whiteTokens)
        const blackScore = bestTokenScore(haystack, blackTokens)
        const hasBothPlayers = whiteScore >= 0.72 && blackScore >= 0.72

        // Strict relevance: stream text should match tournament context and both player names.
        if (tournamentHits <= 0 || !hasBothPlayers) {
          return null
        }

        const relevance = tournamentHits * 4 + whiteScore * 3 + blackScore * 3 + Number(streamer?.stream?.viewers || 0) / 100000
        return { streamer, relevance }
      })
      .filter(Boolean)
      .sort((a, b) => b.relevance - a.relevance)

    return scored.map((row) => row.streamer)
  }, [
    showLiveTournamentStream,
    selectedTournamentGame,
    selectedBroadcast?.name,
    selectedTournament?.fullName,
    selectedTournament?.name,
    liveStreamers
  ])

  const selectedGameDirectStreams = useMemo(() => {
    const id = String(selectedTournamentGame?.id || '').trim()
    if (!id) return []
    return Array.isArray(broadcastStreamsByGame[id]) ? broadcastStreamsByGame[id] : []
  }, [selectedTournamentGame?.id, broadcastStreamsByGame])

  const hasContextualLiveStream = contextualLiveStreamers.length > 0
  const visibleLiveStreamersRaw = hasContextualLiveStream
    ? [...selectedGameDirectStreams, ...broadcastDirectStreams, ...contextualLiveStreamers]
    : [...selectedGameDirectStreams, ...broadcastDirectStreams, ...liveStreamers]

  const visibleLiveStreamers = useMemo(() => {
    const seen = new Set()
    const rows = []
    for (const streamer of visibleLiveStreamersRaw) {
      const key = String(streamer?.stream?.url || '').trim()
      if (!key || seen.has(key)) continue
      seen.add(key)
      rows.push(streamer)
    }
    return rows
  }, [visibleLiveStreamersRaw])

  const hasVisibleLiveStream = visibleLiveStreamers.length > 0
  const selectedStreamerMeta = useMemo(
    () => visibleLiveStreamers.find((streamer) => toEmbeddedStreamUrl(streamer?.stream?.url) === selectedStreamerUrl) || null,
    [visibleLiveStreamers, selectedStreamerUrl]
  )

  const sortedBroadcasts = useMemo(() => {
    return [...broadcasts].sort((a, b) => {
      const liveDiff = Number(Boolean(b?.ongoing)) - Number(Boolean(a?.ongoing))
      if (liveDiff !== 0) return liveDiff

      const aTime = Date.parse(String(a?.startsAt || '')) || 0
      const bTime = Date.parse(String(b?.startsAt || '')) || 0
      return bTime - aTime
    })
  }, [broadcasts])

  const isBroadcastLive = (broadcast) => {
    if (Boolean(broadcast?.ongoing)) return true
    const rounds = Array.isArray(broadcast?.rounds) ? broadcast.rounds : []
    return rounds.some((round) => !Boolean(round?.finished) || Boolean(round?.ongoing))
  }

  const liveBroadcasts = useMemo(
    () => sortedBroadcasts.filter((broadcast) => isBroadcastLive(broadcast)),
    [sortedBroadcasts]
  )

  const pastBroadcasts = useMemo(
    () => sortedBroadcasts.filter((broadcast) => !isBroadcastLive(broadcast)),
    [sortedBroadcasts]
  )

  const filterBroadcastsByQuery = (rows, query) => {
    const normalizedQuery = String(query || '').trim().toLowerCase()
    if (!normalizedQuery) return rows

    return rows.filter((broadcast) => {
      const name = String(broadcast?.name || '').toLowerCase()
      const rounds = Array.isArray(broadcast?.rounds)
        ? broadcast.rounds.map((round) => String(round?.name || '').toLowerCase()).join(' ')
        : ''

      return name.includes(normalizedQuery) || rounds.includes(normalizedQuery)
    })
  }

  const filteredPastBroadcasts = useMemo(() => {
    const query = String(previousBroadcastQuery || '').trim().toLowerCase()
    if (!query) return pastBroadcasts

    const localFiltered = filterBroadcastsByQuery(pastBroadcasts, query)
    const serverFiltered = Array.isArray(searchedPastBroadcasts) ? searchedPastBroadcasts : []
    const merged = []
    const seen = new Set()

    for (const item of [...serverFiltered, ...localFiltered]) {
      const key = String(item?.id || '').trim()
      if (!key || seen.has(key)) continue
      seen.add(key)
      merged.push(item)
    }

    return merged
  }, [pastBroadcasts, previousBroadcastQuery, searchedPastBroadcasts])

  const broadcastKey = (row) => String(row?.slug || row?.id || '').trim()

  const mergeBroadcastEntry = (rows = [], incoming = null) => {
    const key = broadcastKey(incoming)
    if (!key || !incoming) return rows
    return rows.map((row) => {
      const rowKey = broadcastKey(row)
      if (rowKey !== key) return row
      return {
        ...row,
        ...incoming,
        rounds: Array.isArray(incoming?.rounds) ? incoming.rounds : (Array.isArray(row?.rounds) ? row.rounds : [])
      }
    })
  }

  const enrichBroadcastRounds = async (broadcast) => {
    const key = broadcastKey(broadcast)
    if (!key) return
    if (enrichedBroadcastIds[key]) return
    if (broadcastRoundsLoadingById[key]) return

    const seedRoundId = String(
      broadcast?.activeRoundId
      || broadcast?.defaultRoundId
      || (Array.isArray(broadcast?.rounds) && broadcast.rounds[0]?.id)
      || ''
    ).trim()

    if (!seedRoundId) return

    setBroadcastRoundsLoadingById((prev) => ({ ...prev, [key]: true }))
    try {
      const payload = await fetchLichessBroadcastTourByRound(seedRoundId, 180)
      const fullBroadcast = payload?.broadcast || null
      const fullRounds = Array.isArray(fullBroadcast?.rounds) ? fullBroadcast.rounds : []

      if (fullBroadcast && fullRounds.length) {
        setBroadcasts((prev) => mergeBroadcastEntry(prev, fullBroadcast))
        setSearchedPastBroadcasts((prev) => mergeBroadcastEntry(prev, fullBroadcast))
      }

      setEnrichedBroadcastIds((prev) => ({ ...prev, [key]: true }))
    } catch {
      // Keep existing rounds if enrichment fails.
    } finally {
      setBroadcastRoundsLoadingById((prev) => ({ ...prev, [key]: false }))
    }
  }

  useEffect(() => {
    const query = String(previousBroadcastQuery || '').trim()
    if (!query) {
      setSearchedPastBroadcasts([])
      setPastSearchLoading(false)
      return undefined
    }

    if (query.length < 2) {
      setSearchedPastBroadcasts([])
      setPastSearchLoading(false)
      return undefined
    }

    let active = true
    setPastSearchLoading(true)

    const id = setTimeout(async () => {
      const localMatch = (rows, needle) => {
        const q = String(needle || '').trim().toLowerCase()
        if (!q) return rows
        return rows.filter((broadcast) => {
          if (broadcast?.ongoing) return false
          const name = String(broadcast?.name || '').toLowerCase()
          const rounds = Array.isArray(broadcast?.rounds)
            ? broadcast.rounds.map((round) => String(round?.name || '').toLowerCase()).join(' ')
            : ''
          return name.includes(q) || rounds.includes(q)
        })
      }

      try {
        const payload = await fetchLichessBroadcasts(2800, 120, query)
        const rows = Array.isArray(payload?.broadcasts) ? payload.broadcasts : []
        const filteredRows = localMatch(rows, query)

        if (!active) return

        if (filteredRows.length > 0) {
          setSearchedPastBroadcasts(filteredRows)
        } else {
          const fallbackPayload = await fetchLichessBroadcasts(3200, 140)
          const fallbackRows = Array.isArray(fallbackPayload?.broadcasts) ? fallbackPayload.broadcasts : []
          if (!active) return
          setSearchedPastBroadcasts(localMatch(fallbackRows, query))
        }
      } catch {
        if (!active) return
        try {
          const fallbackPayload = await fetchLichessBroadcasts(3200, 140)
          const fallbackRows = Array.isArray(fallbackPayload?.broadcasts) ? fallbackPayload.broadcasts : []
          if (!active) return
          setSearchedPastBroadcasts(localMatch(fallbackRows, query))
        } catch {
          if (!active) return
          setSearchedPastBroadcasts([])
        }
      } finally {
        if (!active) return
        setPastSearchLoading(false)
      }
    }, 320)

    return () => {
      active = false
      clearTimeout(id)
    }
  }, [previousBroadcastQuery])

  const activeWatchTitle = useMemo(() => {
    if (selectedBroadcast?.name) return selectedBroadcast.name
    if (selectedTournament?.fullName || selectedTournament?.name) {
      return selectedTournament.fullName || selectedTournament.name
    }
    return 'Live Tournament'
  }, [selectedBroadcast?.name, selectedTournament?.fullName, selectedTournament?.name])

  useEffect(() => {
    if (!showLiveTournamentStream) {
      setSelectedStreamerUrl('')
      return
    }

    refreshLiveStreamers({ preserveSelection: true })

    const id = setInterval(() => {
      refreshLiveStreamers({ preserveSelection: true })
    }, 20000)

    return () => clearInterval(id)
  }, [showLiveTournamentStream])

  useEffect(() => {
    if (!showLiveTournamentStream || !selectedBroadcastRound) {
      setBroadcastDirectStreams([])
      setBroadcastStreamsByGame({})
      return undefined
    }

    let active = true

    const loadBroadcastStreams = async () => {
      try {
        const payload = await fetchLichessBroadcastRoundStreams(selectedBroadcastRound, selectedTournamentGame?.id || '')
        const streams = Array.isArray(payload?.streams) ? payload.streams : []
        if (!active) return
        setBroadcastDirectStreams(streams)
      } catch {
        if (!active) return
        setBroadcastDirectStreams([])
      }
    }

    loadBroadcastStreams()
    const id = setInterval(loadBroadcastStreams, 15000)

    return () => {
      active = false
      clearInterval(id)
    }
  }, [showLiveTournamentStream, selectedBroadcastRound, selectedTournamentGame?.id])

  useEffect(() => {
    if (!showLiveTournamentStream || !selectedBroadcastRound) {
      setBroadcastStreamsByGame({})
      return undefined
    }

    let active = true

    const loadPerGameStreams = async () => {
      try {
        const payload = await fetchLichessBroadcastRoundGameStreams(selectedBroadcastRound, 24)
        const rows = Array.isArray(payload?.gameStreams) ? payload.gameStreams : []
        if (!active) return

        const mapped = {}
        rows.forEach((row) => {
          const gameId = String(row?.gameId || '').trim()
          if (!gameId) return
          mapped[gameId] = Array.isArray(row?.streams) ? row.streams : []
        })

        setBroadcastStreamsByGame(mapped)
      } catch {
        if (!active) return
        setBroadcastStreamsByGame({})
      }
    }

    loadPerGameStreams()
    const id = setInterval(loadPerGameStreams, 20000)

    return () => {
      active = false
      clearInterval(id)
    }
  }, [showLiveTournamentStream, selectedBroadcastRound])

  useEffect(() => {
    if (analysisOnly || hideLiveOptions) return undefined

    const id = setInterval(() => {
      loadData()
    }, 15000)

    return () => clearInterval(id)
  }, [analysisOnly, hideLiveOptions])

  useEffect(() => {
    if (!showLiveTournamentStream || !hasVisibleLiveStream) {
      setSelectedStreamerUrl('')
      setIsStreamTheaterOpen(false)
      setIsMiniPlayerOpen(false)
      return
    }

    const allowedUrls = visibleLiveStreamers
      .map((streamer) => toEmbeddedStreamUrl(streamer?.stream?.url))
      .filter(Boolean)

    if (!allowedUrls.length) {
      setSelectedStreamerUrl('')
      return
    }

    if (!selectedStreamerUrl || !allowedUrls.includes(selectedStreamerUrl)) {
      setSelectedStreamerUrl(allowedUrls[0])
    }
  }, [showLiveTournamentStream, hasVisibleLiveStream, visibleLiveStreamers, selectedStreamerUrl])

  useEffect(() => {
    if (!isStreamTheaterOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsStreamTheaterOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isStreamTheaterOpen])

  useEffect(() => {
    if (!isMiniDragging) return undefined

    const onMouseMove = (event) => {
      setMiniPlayerPosition({
        x: Math.max(8, event.clientX - miniDragOffsetRef.current.x),
        y: Math.max(8, event.clientY - miniDragOffsetRef.current.y)
      })
    }

    const onMouseUp = () => {
      setIsMiniDragging(false)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isMiniDragging])

  const startMiniDrag = (event) => {
    miniDragOffsetRef.current = {
      x: event.clientX - miniPlayerPosition.x,
      y: event.clientY - miniPlayerPosition.y
    }
    setIsMiniDragging(true)
  }

  const startNewBotGame = () => {
    if (!hideLiveOptions) return

    const startFen = new Chess().fen()
    const nextId = `learn-bot-${Date.now()}`
    setLearnFen(startFen)
    setLearnHistory([startFen])
    setLearnMoves([])
    setLearnPly(0)
    setMeVsBotAnalysisEnabled(true)
    setFollowLive(false)
    setQualityRows([])
    setQualityError('')
    setQualityProgress({ current: 0, total: 0 })
    setSelectedTournamentGame({
      id: nextId,
      white: 'You',
      black: selectedBot.name,
      whiteTitle: '',
      blackTitle: 'BOT',
      whiteFed: '',
      blackFed: '',
      whiteRating: '-',
      blackRating: String(selectedBot.rating),
      fen: startFen,
      status: '*',
      opening: 'Me vs Bot',
      ongoing: false,
      pgn: '',
      moves: ''
    })
    setIsGameViewerOpen(true)
  }

  useEffect(() => {
    if (!isGameViewerOpen || !selectedTournamentGame) {
      setDetectedOpening({ name: '', eco: '' })
      return
    }

    if (!replayMoveCount) {
      setDetectedOpening({ name: '', eco: '' })
      return
    }

    void detectOpeningForCurrentGame([])
  }, [isGameViewerOpen, selectedTournamentGame?.id, selectedTournamentGame?.pgn, replayMoveCount])

  useEffect(() => {
    if (!analysisOnly) return
    if (!selectedTournamentGame) return
    if (!isGameViewerOpen) {
      setIsGameViewerOpen(true)
    }
  }, [analysisOnly, selectedTournamentGame, isGameViewerOpen])

  return (
    <div className={analysisOnly ? 'space-y-4' : 'grid grid-cols-1 gap-4 xl:grid-cols-12'}>
      {!analysisOnly && (
      <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-4 backdrop-blur xl:col-span-8'>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
          <div>
            <h2 className='text-xl font-semibold text-white'>Watch Arena</h2>
            <p className='text-sm text-slate-400'>Live broadcast relay feed with auto-refresh updates.</p>
            <div className='mt-2 flex flex-wrap gap-1.5 text-[11px]'>
              <span className='rounded bg-cyan-500/15 px-2 py-0.5 text-cyan-200'>TV Feed</span>
              <span className='rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-200'>Broadcast</span>
              <span className='rounded bg-indigo-500/15 px-2 py-0.5 text-indigo-200'>Live Relay</span>
              <span className='rounded bg-amber-500/15 px-2 py-0.5 text-amber-200'>Analysis</span>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <button
              onClick={() => loadData()}
              disabled={loading}
              className='rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50'
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className='mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300'>
            {error}
          </div>
        )}

        <div className='mt-4 rounded-lg border border-white/10 bg-[#2d2d30] p-3'>
          <h3 className='mb-2 text-base font-semibold text-white'>Broadcast / Tournament Viewer</h3>
          {selectedTournament && (
            <p className='mb-2 text-xs text-slate-400'>
              {selectedTournament.fullName || selectedTournament.name} ({selectedTournament.id})
            </p>
          )}

          {!selectedTournament && selectedBroadcast && (
            <p className='mb-2 text-xs text-slate-400'>
              Broadcast: {selectedBroadcast.name}
              {selectedBroadcastRound ? ` (${selectedBroadcastRound})` : ''}
            </p>
          )}

          {tournamentError && (
            <p className='mb-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-300'>{tournamentError}</p>
          )}

          {tournamentGames.length > 0 && (
            <div className='mb-3 rounded-lg border border-white/10 bg-[#252526] p-2'>
              <p className='mb-2 text-xs text-slate-300'>Choose a game board</p>
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                {tournamentGames.slice(0, 12).map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      selectGame(g)
                    }}
                    className={`rounded-lg border p-1 text-left transition ${selectedTournamentGame?.id === g.id ? 'border-cyan-300/70 bg-cyan-400/10' : 'border-white/10 bg-[#2d2d30] hover:border-white/25'}`}
                  >
                    <div className='mb-1 overflow-hidden rounded'>
                      <Chessboard
                        id={`mini-${g.id}`}
                        position={g.fen || new Chess().fen()}
                        arePiecesDraggable={false}
                        boardWidth={thumbBoardWidth}
                        animationDuration={180}
                        customDarkSquareStyle={{ backgroundColor: boardTheme.dark }}
                        customLightSquareStyle={{ backgroundColor: boardTheme.light }}
                      />
                      {activeQualityRow?.playedMoveUci ? (() => {
                        const moveUci = activeQualityRow.playedMoveUci
                        const to = moveUci.slice(2, 4)
                        if (!to || to.length < 2) return null
                        const fileIdx = to.charCodeAt(0) - 97
                        const rank = Number(to[1])
                        if (fileIdx < 0 || fileIdx > 7 || !Number.isFinite(rank)) return null
                        const sq = boardWidth / 8
                        const left = fileIdx * sq + sq * 0.72
                        const top = (8 - rank) * sq + sq * 0.04
                        const emoji = getMeta(activeQualityRow.classification).emoji || '✓'
                        return (
                          <div
                            className='pointer-events-none absolute z-20 select-none rounded-full border border-white/30 bg-[#111]/85 px-1 py-0.5 text-[12px] shadow'
                            style={{ left: `${left}px`, top: `${top}px` }}
                            title={activeQualityRow.classification || 'Move quality'}
                          >
                            {emoji}
                          </div>
                        )
                      })() : null}
                    </div>
                    <p className='truncate text-[11px] font-semibold text-white'>{displayName(g.white)} vs {displayName(g.black)}</p>
                    {Array.isArray(broadcastStreamsByGame[g.id]) && broadcastStreamsByGame[g.id].length > 0 ? (
                      <p className='mt-1 text-[10px] font-semibold text-cyan-300'>Video imported</p>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!selectedTournamentGame && tournamentGames.length > 0 && (
            <p className='mb-3 rounded bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200'>
              Click any board above to open it in a separate viewer.
            </p>
          )}

          <div className='max-h-44 space-y-2 overflow-auto text-xs text-slate-300'>
            {tournamentLoading && <p className='text-slate-400'>Loading tournament games...</p>}
            {!tournamentLoading && tournamentGames.length === 0 && <p className='text-slate-400'>Select a tournament to view games here.</p>}
            {tournamentGames.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  selectGame(g)
                }}
                className='w-full rounded-lg border border-white/10 bg-[#252526] px-2 py-2 text-left transition hover:border-white/25'
              >
                <p className='font-semibold text-white'>
                  {displayName(g.white)} vs {displayName(g.black)}
                  {g.ongoing ? <span className='ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300'>LIVE</span> : null}
                </p>
                <p className='text-slate-400'>{g.opening} | {g.status || '-'}</p>
                <p className='text-slate-500'>
                  Moves: {countMoves(g)}
                  {Array.isArray(broadcastStreamsByGame[g.id]) && broadcastStreamsByGame[g.id].length > 0 ? ' • Video imported' : ''}
                </p>
              </button>
            ))}
          </div>
        </div>

      </section>
      )}

      {isGameViewerOpen && selectedTournamentGame && (
        <div className={analysisOnly ? 'max-h-[calc(100vh-150px)] overflow-y-auto rounded-2xl border border-white/10 bg-[#1f1f1f] p-2 sm:p-3' : 'fixed inset-0 z-50 overflow-hidden bg-[#1f1f1f] p-2 sm:p-3'}>
          <div className={`${analysisOnly ? 'overflow-y-auto' : 'h-full overflow-hidden'} w-full rounded-xl border border-white/10 bg-[#1e1e1e] p-2 sm:p-3`}>
            <div className={`grid ${analysisOnly ? 'min-h-0' : 'h-full'} grid-cols-1 items-start gap-3 xl:grid-cols-[240px_minmax(0,1fr)_minmax(320px,430px)]`}>
              <aside className={`${analysisOnly ? 'max-h-[calc(100vh-220px)] overflow-y-auto' : ''} rounded-xl bg-[#252526] p-3 text-white`}>
                <div className='rounded-lg bg-[#2d2d30] p-2'>
                  <div className='mb-2 flex items-center gap-2'>
                    {!hideLiveOptions && selectedTournamentGame.blackPhoto ? (
                      <img
                        src={selectedTournamentGame.blackPhoto}
                        alt={displayName(selectedTournamentGame.black)}
                        className='h-20 w-20 rounded object-cover'
                      />
                    ) : hideLiveOptions ? (
                      <img
                        src={selectedBotAvatar}
                        alt={`${selectedBot.name} avatar`}
                        className='h-20 w-20 rounded object-cover'
                      />
                    ) : (
                      <div className='flex h-20 w-20 items-center justify-center rounded bg-[#4a4a4a] text-sm font-semibold'>
                        {initials(displayName(selectedTournamentGame.black))}
                      </div>
                    )}
                    <div className='min-w-0'>
                      {!hideLiveOptions && selectedTournamentGame.blackTitle && (
                        <span className='inline-block rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold'>
                          {selectedTournamentGame.blackTitle}
                        </span>
                      )}
                      <p className='text-sm font-semibold leading-tight whitespace-normal break-normal'>
                        {hideLiveOptions ? selectedBot.name : (
                          <button
                            type='button'
                            onClick={() => openPlayerProfile(selectedTournamentGame.black)}
                            className='text-left hover:text-cyan-200'
                            title='View player Elo'
                          >
                            {displayName(selectedTournamentGame.black)}
                          </button>
                        )}
                      </p>
                      <p className='text-xs text-slate-300'>
                        {hideLiveOptions ? `BOT ${selectedBot.rating}` : `${federationToFlag(selectedTournamentGame.blackFed)} ${selectedTournamentGame.blackRating || '-'}`}
                      </p>
                      {!hideLiveOptions && selectedTournamentGame.blackEmail ? (
                        <p className='text-[11px] text-slate-400'>{selectedTournamentGame.blackEmail}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className='my-3 space-y-2'>
                  {hideLiveOptions ? (
                    <div className='rounded bg-[#1f1f1f] px-3 py-2 text-center text-sm text-slate-300'>
                      Manual Analysis Mode
                    </div>
                  ) : (
                    <>
                      <div className='rounded bg-[#7fb548] px-2 py-1 text-center text-lg font-semibold'>
                        {playerOutcome(selectedTournamentGame, 'black')}
                      </div>
                      <div className='rounded bg-[#1f1f1f] py-1 text-center text-3xl font-bold'>
                        {formatClock(shownBlackClock)}
                      </div>
                      <div className='rounded bg-[#a1a1a1] px-2 py-1 text-center text-lg font-semibold text-white'>
                        {playerOutcome(selectedTournamentGame, 'white')}
                      </div>
                      <div className='rounded bg-[#f3f3f3] py-1 text-center text-3xl font-bold text-[#111]'>
                        {formatClock(shownWhiteClock)}
                      </div>
                    </>
                  )}
                </div>

                <div className='rounded-lg bg-[#2d2d30] p-2'>
                  <div className='mb-2 flex items-center gap-2'>
                    {!hideLiveOptions && selectedTournamentGame.whitePhoto ? (
                      <img
                        src={selectedTournamentGame.whitePhoto}
                        alt={displayName(selectedTournamentGame.white)}
                        className='h-20 w-20 rounded object-cover'
                      />
                    ) : hideLiveOptions ? (
                      <img
                        src={youAvatar}
                        alt='Your avatar'
                        className='h-20 w-20 rounded object-cover'
                      />
                    ) : (
                      <div className='flex h-20 w-20 items-center justify-center rounded bg-[#4a4a4a] text-sm font-semibold'>
                        {initials(displayName(selectedTournamentGame.white))}
                      </div>
                    )}
                    <div className='min-w-0'>
                      {!hideLiveOptions && selectedTournamentGame.whiteTitle && (
                        <span className='inline-block rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold'>
                          {selectedTournamentGame.whiteTitle}
                        </span>
                      )}
                      <p className='text-sm font-semibold leading-tight whitespace-normal break-normal'>
                        {hideLiveOptions ? 'You' : (
                          <button
                            type='button'
                            onClick={() => openPlayerProfile(selectedTournamentGame.white)}
                            className='text-left hover:text-cyan-200'
                            title='View player Elo'
                          >
                            {displayName(selectedTournamentGame.white)}
                          </button>
                        )}
                      </p>
                      <p className='text-xs text-slate-300'>
                        {hideLiveOptions ? 'White Side' : `${federationToFlag(selectedTournamentGame.whiteFed)} ${selectedTournamentGame.whiteRating || '-'}`}
                      </p>
                      {!hideLiveOptions && selectedTournamentGame.whiteEmail ? (
                        <p className='text-[11px] text-slate-400'>{selectedTournamentGame.whiteEmail}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                {showLiveTournamentStream && (
                  <div className='mt-3 rounded-lg border border-white/10 bg-[#1f1f1f] p-2'>
                    <div className='mb-2 flex items-center justify-between gap-2'>
                      <p className='text-[11px] font-semibold uppercase tracking-wide text-slate-300'>Live Stream</p>
                      <div className='flex items-center gap-1'>
                        <button
                          onClick={() => {
                            if (selectedStreamerUrl) setIsStreamTheaterOpen(true)
                          }}
                          disabled={!selectedStreamerUrl}
                          className='rounded border border-white/15 px-2 py-1 text-[10px] text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          Theater
                        </button>
                        <button
                          onClick={() => {
                            if (selectedStreamerUrl) setIsMiniPlayerOpen((prev) => !prev)
                          }}
                          disabled={!selectedStreamerUrl}
                          className='rounded border border-white/15 px-2 py-1 text-[10px] text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          {isMiniPlayerOpen ? 'Hide Mini' : 'Mini Player'}
                        </button>
                      </div>
                    </div>
                    {selectedStreamerUrl ? (
                      <div className='overflow-hidden rounded border border-white/10 bg-[#101010]'>
                        <iframe
                          title='Live game stream'
                          src={selectedStreamerUrl}
                          className='h-[190px] w-full'
                          allow='autoplay; encrypted-media; picture-in-picture; fullscreen'
                          referrerPolicy='strict-origin-when-cross-origin'
                          loading='lazy'
                        />
                      </div>
                    ) : (
                      <p className='rounded bg-[#252526] px-2 py-2 text-xs text-slate-400'>
                        No live tournament video currently available.
                      </p>
                    )}

                    {hasVisibleLiveStream && (
                      <div className='mt-2 max-h-32 space-y-1 overflow-auto text-[11px] text-slate-300'>
                        {visibleLiveStreamers.map((streamer) => {
                          const embed = toEmbeddedStreamUrl(streamer?.stream?.url)
                          return (
                            <button
                              key={`viewer-${streamer.id}`}
                              onClick={() => {
                                if (embed) setSelectedStreamerUrl(embed)
                              }}
                              className={`w-full rounded border px-2 py-1 text-left transition ${selectedStreamerUrl === embed ? 'border-cyan-300/70 bg-cyan-500/10' : 'border-white/10 bg-[#252526] hover:border-white/25'}`}
                            >
                              <p className='truncate font-semibold text-white'>{streamer.title ? `${streamer.title} ` : ''}{streamer.name}</p>
                              <p className='truncate text-slate-400'>{streamer.stream?.status || streamer.headline || streamer.stream?.url}</p>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </aside>

              <div className={`${analysisOnly ? 'overflow-visible' : ''} min-w-0 self-start rounded-xl bg-[#252526] p-2`}>
                <div className='space-y-2 rounded-lg bg-[#1f1f1f] p-2'>
                  {showEvalBar && (
                    <div className='rounded-lg bg-[#2b2b2b] px-4 py-3 shadow-sm'>
                      <div className='flex items-center gap-2 mb-1'>
                        <div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
                        <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-400'>Opening</p>
                      </div>
                      <p className='text-sm font-semibold text-white'>
                        {detectingOpening
                          ? 'Detecting opening...'
                          : (detectedOpening.name
                              ? `${detectedOpening.name}${detectedOpening.eco ? ` (${detectedOpening.eco})` : ''}`
                              : 'Not detected yet')}
                      </p>
                    </div>
                  )}

                  <div
                    className='grid items-start justify-center gap-x-3'
                    style={{ gridTemplateColumns: showEvalBar ? `${evalColumnWidth}px ${boardWidth}px` : `${boardWidth}px` }}
                  >
                    {showEvalBar && (
                      <div className='flex flex-none flex-col items-center gap-2' style={{ width: `${evalColumnWidth}px` }}>
                        {/* Chess.com style evaluation bar */}
                        <div
                          className='relative overflow-hidden rounded-lg border border-white/15 shadow-[0_8px_18px_rgba(0,0,0,0.45)]'
                          style={{
                            width: `${evalTrackWidth}px`,
                            minWidth: `${evalTrackWidth}px`,
                            maxWidth: `${evalTrackWidth}px`,
                            height: `${boardWidth}px`,
                            minHeight: `${boardWidth}px`,
                            maxHeight: `${boardWidth}px`,
                            background: 'linear-gradient(180deg, #2b2b2b 0%, #1a1a1a 100%)'
                          }}
                        >
                          <div className='pointer-events-none absolute left-1/2 top-1 z-20 -translate-x-1/2 rounded bg-black/60 px-1 py-[1px] text-[9px] font-bold uppercase tracking-wide text-slate-200'>B</div>
                          {/* Black section (top) */}
                          <div
                            className='absolute left-0 right-0 top-0 bg-[#111111]'
                            style={{ height: `${100 - evalBarPercent}%` }}
                          />
                          {/* White section (bottom) with gradient */}
                          <div
                            className='absolute bottom-0 left-0 right-0'
                            style={{
                              height: `${evalBarPercent}%`,
                              background: 'linear-gradient(180deg, #f0f0f0 0%, #ffffff 100%)'
                            }}
                          />
                          {/* Evaluation indicator line */}
                          <div
                            className='absolute left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                            style={{ bottom: `${Math.round(evalBarPercent)}%`, transform: 'translateY(50%)' }}
                          />
                          {/* Center marker */}
                          <div
                            className='absolute left-0 right-0 z-10 h-[1px] bg-slate-500/50'
                            style={{ bottom: '50%' }}
                          />
                          <div className='pointer-events-none absolute bottom-1 left-1/2 z-20 -translate-x-1/2 rounded bg-black/60 px-1 py-[1px] text-[9px] font-bold uppercase tracking-wide text-slate-200'>W</div>
                        </div>
                        {/* Large evaluation display */}
                        <div className='flex flex-col items-center gap-0.5'>
                          <div className={`text-lg font-bold ${Number(evalLabel?.replace(/[+#-]/g, '') || 0) > 0 ? 'text-white' : Number(evalLabel?.replace(/[+#-]/g, '') || 0) < 0 ? 'text-slate-400' : 'text-slate-300'}`}>
                            {evalLabel}
                          </div>
                          <div className='text-[9px] font-medium text-slate-500 uppercase tracking-wider'>
                            {whiteEvaluation?.type === 'mate' ? 'Mate' : 'Eval'}
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={mainBoardContainerRef} className='relative flex-none overflow-hidden' style={{ width: `${boardWidth}px`, height: `${boardWidth}px`, contain: 'layout paint' }}>
                      <div className='relative h-full w-full'>
                        <StableLiveBoard
                          position={activeBoardFen}
                          isDraggable={hideLiveOptions}
                          onPieceDrop={hideLiveOptions ? handleLearnPieceDrop : undefined}
                          boardWidth={boardWidth}
                          darkSquareStyle={boardDarkSquareStyle}
                          lightSquareStyle={boardLightSquareStyle}
                          arrows={boardArrows}
                          squareStyles={boardSquareStylesForRender}
                        />
                        {/* Move marker at upper-right of destination square (only current move). */}
                        {!isBoardAnimating && activeQualityRow?.playedMoveUci ? (() => {
                          const to = activeQualityRow.playedMoveUci.slice(2, 4)
                          if (!to || to.length < 2) return null

                          const fileIdx = to.charCodeAt(0) - 97
                          const rank = Number(to[1])
                          if (fileIdx < 0 || fileIdx > 7 || !Number.isFinite(rank)) return null

                          const sq = boardWidth / 8
                          const left = fileIdx * sq + sq * 0.66
                          const top = (8 - rank) * sq + sq * 0.03
                          const marker = moveMarkerForLabel(activeQualityRow.classification)

                          return (
                            <div
                              className='pointer-events-none absolute z-30 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/35 text-lg font-extrabold text-white shadow-lg'
                              style={{ left: `${left}px`, top: `${top}px`, backgroundColor: marker.bg }}
                              title={activeQualityRow.classification || 'Move quality'}
                            >
                              {marker.text}
                            </div>
                          )
                        })() : null}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <aside className={`${analysisOnly ? 'max-h-[calc(100vh-220px)] overflow-y-auto' : 'h-full overflow-y-scroll'} overflow-x-hidden rounded-xl bg-[#252526] p-3 text-white`}>
                {!analysisOnly && (
                  <div className='mb-2 flex items-center justify-between rounded bg-[#252526] px-3 py-2'>
                    <p className='truncate text-sm font-semibold'>
                      {hideLiveOptions
                        ? (canShowMeVsBotAnalysis ? 'Game Analysis' : 'Me vs Bot')
                        : (selectedTournament?.fullName || selectedTournament?.name || selectedBroadcast?.name || 'Broadcast')}
                    </p>
                    {!hideLiveOptions && (
                      <a
                        href={selectedTournamentGame.url || '#'}
                        target='_blank'
                        rel='noreferrer'
                        className='text-xs text-slate-300 underline decoration-dotted'
                      >
                        Open
                      </a>
                    )}
                  </div>
                )}

                <div className='mb-2 flex items-start justify-between rounded bg-[#252526] px-3 py-2'>
                  <p className='truncate text-sm font-semibold'>{hideLiveOptions ? `Me vs ${selectedBot.name} (${selectedBot.rating})` : `SF 18 NNUE · ${powerMode.toUpperCase()} · D${analysisDepth}`}</p>
                  <div className='flex items-center gap-2'>
                    {!analysisOnly && (
                      <button
                        onClick={() => setIsGameViewerOpen(false)}
                        className='rounded border border-white/15 px-2 py-1 text-xs text-slate-200 transition hover:border-white/30'
                      >
                        Back
                      </button>
                    )}
                  </div>
                </div>
                {reviewLoading ? (
                  <div className='mb-2 rounded border border-white/10 bg-[#1f1f1f] px-3 py-2 text-xs text-slate-300'>
                    Loading completed games...
                  </div>
                ) : null}
                {analysisOnly && !hideLiveOptions && tournamentGames.length > 0 ? (
                  <div className='mb-2 rounded border border-white/10 bg-[#1f1f1f] px-3 py-2'>
                    <p className='mb-1 text-[11px] uppercase tracking-wide text-slate-400'>Your Games</p>
                    <select
                      value={String(selectedTournamentGame?.id || '')}
                      onChange={(e) => {
                        const next = tournamentGames.find((row) => String(row.id) === String(e.target.value))
                        if (next) {
                          selectGame(next, false)
                        }
                      }}
                      className='w-full rounded border border-white/15 bg-[#2d2d30] px-2 py-1 text-xs text-slate-100'
                    >
                      {tournamentGames.map((gameRow, index) => (
                        <option key={gameRow.id} value={gameRow.id}>
                          {`${index + 1}. ${displayName(gameRow.white)} vs ${displayName(gameRow.black)}${gameRow.endedAt ? ` (${new Date(gameRow.endedAt).toLocaleDateString()})` : ''}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {reviewError ? (
                  <div className='mb-2 rounded border border-red-300/30 bg-red-500/10 px-3 py-2 text-xs text-red-300'>
                    {reviewError}
                  </div>
                ) : null}
                {playerProfileLoading ? (
                  <div className='mb-2 rounded border border-white/10 bg-[#1f1f1f] px-3 py-2 text-xs text-slate-300'>
                    Loading player Elo...
                  </div>
                ) : null}
                {playerProfileError ? (
                  <div className='mb-2 rounded border border-red-300/30 bg-red-500/10 px-3 py-2 text-xs text-red-300'>
                    {playerProfileError}
                  </div>
                ) : null}
                {playerProfile ? (
                  <div className='mb-2 rounded border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100'>
                    <div className='mb-1 flex items-center justify-between'>
                      <p className='font-semibold'>{playerProfile.username}</p>
                      <button
                        type='button'
                        onClick={() => setPlayerProfile(null)}
                        className='text-[11px] text-cyan-200 hover:text-white'
                      >
                        Close
                      </button>
                    </div>
                    <p className='text-[11px] text-cyan-200'>{playerProfile.email || '-'}</p>
                    <p className='mt-1'>Bullet: <span className='font-semibold'>{playerProfile?.ratings?.bullet ?? 100}</span> | Blitz: <span className='font-semibold'>{playerProfile?.ratings?.blitz ?? 100}</span> | Rapid: <span className='font-semibold'>{playerProfile?.ratings?.rapid ?? 100}</span></p>
                  </div>
                ) : null}
                {hideLiveOptions && (
                  <div className='mb-2 rounded border border-white/10 bg-[#1f1f1f] px-3 py-2 text-xs text-slate-300'>
                    You always play White. Bot responds as Black. Change difficulty from the Bot Difficulty selector.
                  </div>
                )}
                {hideLiveOptions && !meVsBotGameState.isOver && (
                  <div className='mb-2 rounded border border-white/10 bg-[#1f1f1f] px-3 py-2 text-xs text-slate-300'>
                    Analysis is hidden during play. Finish the game to unlock post-game analysis.
                  </div>
                )}
                {hideLiveOptions && meVsBotGameState.isOver && (
                  <div className='mb-2 rounded border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100'>
                    <p>{meVsBotGameState.summary}</p>
                    <button
                      type='button'
                      onClick={() => setMeVsBotAnalysisEnabled((prev) => !prev)}
                      className='mt-2 rounded border border-emerald-300/45 px-2 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-500/20'
                    >
                      {meVsBotAnalysisEnabled ? 'Hide Analysis' : 'Show Analysis'}
                    </button>
                  </div>
                )}

                {canShowMeVsBotAnalysis && (
                <>
                {/* Real engine PV lines */}
                <div className='mb-2 rounded border border-lime-500/50 bg-[#1f1f1f]'>
                  <div className='flex items-center justify-between border-b border-white/10 px-3 py-2 text-[12px] text-slate-300'>
                    <span>Engine Lines</span>
                    <span className='font-semibold text-[#dfe9ff]'>
                      {evalLabel}
                    </span>
                  </div>
                  <div className='space-y-1 px-2 py-2 text-[12px]'>
                    {displayPvLines.length > 0 ? displayPvLines.map((line, i) => {
                      const lineColors = ['text-emerald-300', 'text-sky-300', 'text-slate-400']
                      if (!line) return null
                      const pvText = hideLiveOptions && meVsBotGameState.isOver
                        ? String(line.pv || '')
                        : String(line.pv || '').split(' ').slice(0, 5).join(' ')
                      return (
                        <div key={i} className='flex items-start gap-1.5 rounded bg-[#2d2d30] px-2 py-1'>
                          <span className={`font-bold ${lineColors[i] || 'text-slate-300'}`}>{i + 1}.</span>
                          <span className='font-semibold text-slate-100'>{line.evalLabel}</span>
                          <span className='break-all text-slate-400'>{pvText}</span>
                        </div>
                      )
                    }) : (
                      <div className='rounded bg-[#2d2d30] px-2 py-1 text-slate-300'>
                        {bestMove ? `Best: ${bestMove}` : 'Analyzing…'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Move feedback panel */}
                {qualityRows.length > 0 && (
                  <div className='mb-2 rounded border border-white/10 bg-[#1f1f1f] p-2'>
                    <p className='mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400'>Move Summary</p>
                    <div className='space-y-0.5'>
                      {FEEDBACK_ROWS.map(({ label, emoji }) => {
                        const wCnt = qualityRows.filter((r) => r.classification === label && r.color === 'w').length
                        const bCnt = qualityRows.filter((r) => r.classification === label && r.color === 'b').length
                        const meta = getMeta(label)
                        return (
                          <div key={label} className='grid grid-cols-[1fr_120px_1fr] items-center gap-1 rounded px-1 py-0.5 hover:bg-white/5'>
                            <span className={`text-right text-xs font-bold ${wCnt > 0 ? meta.textClass : 'text-slate-700'}`}>{wCnt}</span>
                            <div className='flex items-center justify-center gap-1.5'>
                              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${meta.bgClass} border ${meta.borderClass}`}>{emoji}</span>
                              <span className={`text-[10px] font-semibold ${meta.textClass}`}>{label}</span>
                            </div>
                            <span className={`text-left text-xs font-bold ${bCnt > 0 ? meta.textClass : 'text-slate-700'}`}>{bCnt}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className='mb-2 rounded border border-white/10 bg-[#1f1f1f] p-2'>
                  <div className='mb-2 grid grid-cols-3 items-center gap-2'>
                    <div className='rounded border border-white/15 bg-[#2d2d30] px-2 py-1 text-center'>
                      <p className='text-[11px] text-slate-300'>White</p>
                      <p className='text-2xl font-bold text-white'>{qualityRows.length ? whiteAccuracy : '-'}</p>
                      <p className='text-xs font-semibold text-slate-300'>Accuracy</p>
                    </div>
                    <div className='text-center text-xl text-slate-500'>*</div>
                    <div className='rounded border border-white/15 bg-[#2d2d30] px-2 py-1 text-center'>
                      <p className='text-[11px] text-slate-300'>Black</p>
                      <p className='text-2xl font-bold text-white'>{qualityRows.length ? blackAccuracy : '-'}</p>
                      <p className='text-xs font-semibold text-slate-300'>Accuracy</p>
                    </div>
                  </div>

                  {/* ── Evaluation Graph ─────────────────────────────── */}
                  <div className='rounded border border-white/10 bg-[#1a1a1a] p-1'>
                    {qualityGraphData.points.length === 0 ? (
                      <div className='flex h-20 items-center justify-center'>
                        <span className='text-[11px] text-slate-500'>
                          {qualityRunning ? `Analyzing ${qualityProgress.current}/${qualityProgress.total}…` : 'Run analysis to see eval graph'}
                        </span>
                      </div>
                    ) : (
                      <svg
                        viewBox={`0 0 ${qualityGraphData.W} ${qualityGraphData.H}`}
                        className='h-24 w-full cursor-crosshair'
                        preserveAspectRatio='none'
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const relX = e.clientX - rect.left
                          const frac = relX / rect.width
                          const targetIdx = Math.round(frac * Math.max(0, qualityGraphData.points.length - 1))
                          const row = qualityGraphData.points[targetIdx]?.row
                          if (row) jumpToPly(row.ply)
                        }}
                      >
                        <path
                          d={qualityGraphData.fullArea}
                          fill='rgba(242,242,242,0.94)'
                        />

                        {/* Center baseline */}
                        <line
                          x1={qualityGraphData.padL}
                          y1={qualityGraphData.midY}
                          x2={qualityGraphData.padL + qualityGraphData.innerW}
                          y2={qualityGraphData.midY}
                          stroke='rgba(255,255,255,0.35)'
                          strokeWidth='0.8'
                        />

                        {/* Eval line */}
                        <path
                          d={qualityGraphData.linePath}
                          fill='none'
                          stroke='rgba(255,255,255,0.95)'
                          strokeWidth='1.7'
                          strokeLinejoin='round'
                          strokeLinecap='round'
                        />

                        {/* Show a tiny marker for every ply so full move count is visibly represented. */}
                        {qualityGraphData.points.map(({ x, y, row }) => (
                          <circle
                            key={`ply-dot-${row.ply}`}
                            cx={x}
                            cy={y}
                            r='1.4'
                            fill={row.evalAfter ? 'rgba(170,190,220,0.45)' : 'rgba(120,130,150,0.28)'}
                          />
                        ))}

                        {/* Classification dots (all categories) */}
                        {qualityGraphData.points.map(({ x, y, row }) => {
                          const cl = row.classification
                          if (!cl) return null
                          const fill = getMeta(cl).color || '#94a3b8'
                          return (
                            <circle
                              key={row.ply}
                              cx={x}
                              cy={y}
                              r='3.6'
                              fill={fill}
                              stroke='rgba(10,10,10,0.75)'
                              strokeWidth='0.9'
                            />
                          )
                        })}

                        {/* Current ply cursor */}
                        {(() => {
                          const activePt = qualityGraphData.points.find((p) => p.row.ply === activeReplayPly)
                            || qualityGraphData.points.find((p) => p.row.ply <= activeReplayPly)
                          if (!activePt) return null
                          return (
                            <>
                              <line
                                x1={activePt.x}
                                y1={qualityGraphData.padT}
                                x2={activePt.x}
                                y2={qualityGraphData.H - qualityGraphData.padB}
                                stroke='rgba(96,165,250,0.9)'
                                strokeWidth='1.5'
                                strokeDasharray='3 2'
                              />
                              <circle
                                cx={activePt.x}
                                cy={activePt.y}
                                r='4'
                                fill='#60a5fa'
                                stroke='rgba(255,255,255,0.7)'
                                strokeWidth='1'
                              />
                            </>
                          )
                        })()}
                      </svg>
                    )}
                  </div>

                  <div className='mt-2 flex items-center justify-between gap-2'>
                    <button
                      onClick={runQualityReview}
                      disabled={!engineReady || qualityRunning || !(tournamentReplay.moves || []).length}
                      className='rounded border border-white/15 px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50'
                    >
                      {qualityRunning ? `Analyzing ${qualityProgress.current}/${qualityProgress.total}` : 'Analyze Move Quality'}
                    </button>
                    <div className='flex flex-wrap items-center gap-1.5 text-[10px]'>
                      {FEEDBACK_ROWS.map(({ label }) => {
                        const meta = getMeta(label)
                        return (
                          <span key={`legend-${label}`} className='flex items-center gap-0.5'>
                            <span className='inline-block h-2 w-2 rounded-full' style={{ backgroundColor: meta.color || '#94a3b8' }} />
                            {label}
                          </span>
                        )
                      })}
                      <span className='flex items-center gap-0.5'>
                        <span className='inline-block h-2 w-2 rounded-full bg-[#60a5fa]' />Current
                      </span>
                    </div>
                  </div>

                  {qualityError ? <p className='mt-1 text-[11px] text-red-300'>{qualityError}</p> : null}
                </div>

                <div className='mb-2 max-h-[43vh] overflow-y-scroll overflow-x-hidden rounded bg-[#1f1f1f]'>
                  <table className='w-full text-left text-[13px]'>
                    <thead className='sticky top-0 bg-[#2d2d30] text-slate-300'>
                      <tr>
                        <th className='px-2 py-2'>#</th>
                        <th className='px-2 py-2'>White</th>
                        <th className='px-2 py-2'>Eval</th>
                        <th className='px-2 py-2'>Black</th>
                        <th className='px-2 py-2'>Eval</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moveRows.length === 0 ? (
                        <tr>
                          <td className='px-2 py-3 text-slate-400' colSpan={5}>
                            Status: {normalizeStatusLabel(selectedTournamentGame.status)} | Opening: {selectedTournamentGame.opening || '-'}
                          </td>
                        </tr>
                      ) : (
                        moveRows.map((row, idx) => (
                          <tr key={row.move} className='border-t border-white/5'>
                            <td className='px-2 py-1 text-slate-500'>{row.move}</td>
                            <td className='px-2 py-1 text-slate-100'>
                              <button
                                type='button'
                                onClick={() => jumpToPly(row.move * 2 - 1)}
                                className={`rounded px-1 py-0.5 transition ${activeReplayPly === row.move * 2 - 1 ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-100 hover:bg-white/10'}`}
                                title={`Jump to ${row.white}`}
                              >
                                {row.white}
                              </button>
                            </td>
                            <td className='px-2 py-1 text-slate-400'>
                              {formatWhiteEvalLabel(qualityByPly.get(row.move * 2 - 1)?.evalAfter, '-')}
                              {qualityByPly.get(row.move * 2 - 1)?.classification ? (
                                <span className={`ml-1 inline-block rounded border px-1 py-0.5 text-[10px] ${qualityBadgeClass(qualityByPly.get(row.move * 2 - 1).classification)}`}>
                                  {qualityByPly.get(row.move * 2 - 1).classification}
                                </span>
                              ) : null}
                            </td>
                            <td className='px-2 py-1 text-slate-100'>
                              {row.black ? (
                                <button
                                  type='button'
                                  onClick={() => jumpToPly(row.move * 2)}
                                  className={`rounded px-1 py-0.5 transition ${activeReplayPly === row.move * 2 ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-100 hover:bg-white/10'}`}
                                  title={`Jump to ${row.black}`}
                                >
                                  {row.black}
                                </button>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className='px-2 py-1 text-slate-400'>
                              {formatWhiteEvalLabel(qualityByPly.get(row.move * 2)?.evalAfter, '-')}
                              {qualityByPly.get(row.move * 2)?.classification ? (
                                <span className={`ml-1 inline-block rounded border px-1 py-0.5 text-[10px] ${qualityBadgeClass(qualityByPly.get(row.move * 2).classification)}`}>
                                  {qualityByPly.get(row.move * 2).classification}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                </>
                )}

                <div className='rounded bg-[#252526] px-2 py-2'>
                  <div className='mb-2 flex items-center justify-between text-xs text-slate-300'>
                    <span className='flex items-center gap-2'>
                      <span>Stockfish {engineReady ? '(ready)' : '(loading...)'}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${nnueEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}
                      >
                        NNUE {nnueEnabled ? 'ON' : 'OFF'}
                      </span>
                      {!hideLiveOptions && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${followLive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}
                        >
                          LIVE {followLive ? 'ON' : 'OFF'}
                        </span>
                      )}
                    </span>
                    <span>{botThinking ? 'Bot thinking...' : isAnalyzing ? 'Analyzing...' : 'Idle'}</span>
                  </div>
                  <div className='mb-2'>
                    <button
                      onClick={() => setNnueMode(!nnueMode)}
                      className='rounded border border-white/15 px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10'
                    >
                      Turn NNUE {nnueMode ? 'OFF' : 'ON'}
                    </button>
                  </div>
                  <div className='mb-2'>
                    <label className='text-[11px] text-slate-300'>
                      NNUE Model
                      <select
                        value={selectedNnueNetworkId}
                        onChange={(e) => setNnueNetwork(e.target.value)}
                        className='mt-1 w-full rounded border border-white/15 bg-[#1e1e1e] px-2 py-1 text-[11px] text-slate-100'
                      >
                        {nnueNetworks.map((network) => (
                          <option key={network.id} value={network.id}>{network.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {hideLiveOptions && (
                    <div className='mb-2'>
                      <label className='text-[11px] text-slate-300'>
                        Bot Difficulty
                        <select
                          value={selectedBotId}
                          onChange={(e) => setSelectedBotId(e.target.value)}
                          className='mt-1 w-full rounded border border-white/15 bg-[#1e1e1e] px-2 py-1 text-[11px] text-slate-100'
                        >
                          {LEARN_BOTS.map((bot) => (
                            <option key={bot.id} value={bot.id}>{bot.name} ({bot.rating})</option>
                          ))}
                        </select>
                      </label>
                      <button
                        onClick={startNewBotGame}
                        className='mt-2 rounded border border-white/15 px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10'
                      >
                        New Bot Game
                      </button>
                    </div>
                  )}
                  <div className='mb-2 grid grid-cols-2 gap-2'>
                    <label className='text-[11px] text-slate-300'>
                      Engine Power
                      <select
                        value={powerMode}
                        onChange={(e) => setPowerMode(e.target.value)}
                        className='mt-1 w-full rounded border border-white/15 bg-[#1e1e1e] px-2 py-1 text-[11px] text-slate-100'
                      >
                        <option value='balanced'>Balanced</option>
                        <option value='strong'>Strong</option>
                        <option value='max'>Max</option>
                      </select>
                    </label>
                    <label className='text-[11px] text-slate-300'>
                      Depth
                      <select
                        value={analysisDepth}
                        onChange={(e) => setAnalysisDepth(Number(e.target.value))}
                        className='mt-1 w-full rounded border border-white/15 bg-[#1e1e1e] px-2 py-1 text-[11px] text-slate-100'
                      >
                        <option value={14}>14</option>
                        <option value={16}>16</option>
                        <option value={18}>18</option>
                        <option value={20}>20</option>
                        <option value={22}>22</option>
                      </select>
                    </label>
                  </div>
                  <p className='mb-2 text-[10px] text-slate-400'>
                    Strongest mode: NNUE ON + Power Max + Depth 20-22.
                  </p>
                  {!analysisOnly && !hideLiveOptions && (
                    <div className='mb-2'>
                      <button
                        onClick={() => setFollowLive((prev) => {
                          const next = !prev
                          if (next) {
                            setTournamentPly(9999)
                          }
                          return next
                        })}
                        className='rounded border border-white/15 px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10'
                      >
                        Turn Live {followLive ? 'OFF' : 'ON'}
                      </button>
                    </div>
                  )}
                  <div className='mb-2 flex flex-wrap gap-2'>
                    <button
                      onClick={goPrev}
                      disabled={hideLiveOptions ? clampedLearnPly <= 0 : clampedTournamentPly <= 0}
                      className='rounded border border-white/15 px-3 py-1 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-50'
                    >
                      Previous Move
                    </button>
                    <button
                      onClick={goNext}
                      disabled={hideLiveOptions ? clampedLearnPly >= learnMaxPly : clampedTournamentPly >= tournamentMaxPly}
                      className='rounded border border-white/15 px-3 py-1 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-50'
                    >
                      Next Move
                    </button>
                  </div>
                  <p className='text-xs text-slate-300'>
                    Ply: <span className='font-semibold text-white'>{hideLiveOptions ? clampedLearnPly : clampedTournamentPly}</span> / {hideLiveOptions ? learnMaxPly : tournamentMaxPly}
                  </p>
                  {!hideLiveOptions && (
                    <p className='text-xs text-slate-400'>
                      Clock mode: <span className='text-slate-200'>{followLive ? 'Live side-to-move' : 'Replay paused'}</span>
                    </p>
                  )}
                  {!hideLiveOptions && (
                    <p className='text-xs text-slate-400'>
                      Feed updated: <span className='text-slate-200'>{tournamentLastUpdated ? tournamentLastUpdated.toLocaleTimeString() : '-'}</span>
                    </p>
                  )}
                  {engineError ? <p className='mt-1 text-[11px] text-red-300'>{engineError}</p> : null}
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {!analysisOnly && (
      <aside className='space-y-4 xl:col-span-4'>
        <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-4 backdrop-blur'>
          <div className='mb-3 flex items-center justify-between gap-2'>
            <h3 className='text-base font-semibold text-white'>Tournaments</h3>
            <span className='rounded bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-200'>Auto Refresh: 15s</span>
          </div>

          {broadcastsLoading && broadcasts.length === 0 && (
            <p className='mb-2 text-xs text-slate-400'>Loading tournaments...</p>
          )}

          <div className='rounded-lg border border-white/10 bg-[#2d2d30]/60 p-2'>
            <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300'>All Live Tournaments</p>
            <div className='max-h-[32vh] space-y-2 overflow-auto text-sm text-slate-300'>
              {!broadcastsLoading && liveBroadcasts.length === 0 && <p className='text-slate-400'>No live tournaments right now.</p>}
              {liveBroadcasts.map((b) => {
                const isExpanded = expandedBroadcastId === String(b.id)
                const rounds = Array.isArray(b.rounds) ? b.rounds : []

                return (
                  <div key={b.id} className='rounded-lg border border-white/10 bg-[#2d2d30]'>
                    <button
                      onClick={() => {
                        const next = isExpanded ? '' : String(b.id)
                        setExpandedBroadcastId(next)
                        if (!isExpanded) {
                          enrichBroadcastRounds(b)
                        }
                      }}
                      className='block w-full px-2 py-2 text-left'
                    >
                      <div className='mb-2 overflow-hidden rounded-md border border-white/10 bg-[#1f1f1f]'>
                        {b.image ? (
                          <img src={b.image} alt={b.name} className='h-24 w-full object-cover' loading='lazy' />
                        ) : (
                          <div className='flex h-24 items-center justify-center bg-gradient-to-br from-[#334155] to-[#0f172a] text-xs font-semibold text-slate-300'>
                            Tournament
                          </div>
                        )}
                      </div>
                      <div className='flex items-start justify-between gap-2'>
                        <p className='line-clamp-2 font-semibold text-white'>{b.name}</p>
                        <span className='shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300'>LIVE</span>
                      </div>
                      <p className='mt-1 text-[11px] text-slate-400'>Rounds: {rounds.length}</p>
                    </button>

                    {isExpanded && (
                      <div className='border-t border-white/10 px-2 py-2'>
                        <p className='mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400'>Rounds</p>
                        {broadcastRoundsLoadingById[broadcastKey(b)] ? (
                          <p className='mb-1 text-[11px] text-slate-500'>Loading all rounds...</p>
                        ) : null}
                        <div className='space-y-1'>
                          {rounds.length === 0 && <p className='text-xs text-slate-500'>No rounds available.</p>}
                          {rounds.map((round) => (
                            <button
                              key={round.id}
                              onClick={() => loadBroadcastRound(b, round.id)}
                              className={`block w-full rounded border px-2 py-1 text-left text-xs transition ${selectedBroadcastRound === round.id ? 'border-cyan-300/70 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-[#252526] text-slate-200 hover:border-white/25'}`}
                            >
                              <div className='flex items-center justify-between gap-2'>
                                <span className='truncate'>{round.name || 'Round'}</span>
                                <span className={`rounded px-1 py-0.5 text-[10px] ${round.ongoing ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300'}`}>
                                  {round.ongoing ? 'LIVE' : 'ROUND'}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className='mt-3 rounded-lg border border-white/10 bg-[#2d2d30]/60 p-2'>
            <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300'>All Past Tournaments</p>
            <div className='mb-2'>
              <input
                type='text'
                value={previousBroadcastQuery}
                onChange={(e) => setPreviousBroadcastQuery(e.target.value)}
                placeholder='Search past tournaments...'
                className='w-full rounded border border-white/15 bg-[#1f1f1f] px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none'
              />
            </div>
            <div className='max-h-[32vh] space-y-2 overflow-auto text-sm text-slate-300'>
              {!broadcastsLoading && pastBroadcasts.length === 0 && <p className='text-slate-400'>No past tournaments found.</p>}
              {pastSearchLoading && previousBroadcastQuery.trim() && (
                <p className='text-slate-400'>Searching all past tournaments...</p>
              )}
              {pastBroadcasts.length > 0 && filteredPastBroadcasts.length === 0 && (
                <p className='text-slate-400'>No matches for "{previousBroadcastQuery.trim()}".</p>
              )}
              {filteredPastBroadcasts.map((b) => {
                const isExpanded = expandedBroadcastId === String(b.id)
                const rounds = Array.isArray(b.rounds) ? b.rounds : []

                return (
                  <div key={b.id} className='rounded-lg border border-white/10 bg-[#2d2d30]'>
                    <button
                      onClick={() => {
                        const next = isExpanded ? '' : String(b.id)
                        setExpandedBroadcastId(next)
                        if (!isExpanded) {
                          enrichBroadcastRounds(b)
                        }
                      }}
                      className='block w-full px-2 py-2 text-left'
                    >
                      <div className='mb-2 overflow-hidden rounded-md border border-white/10 bg-[#1f1f1f]'>
                        {b.image ? (
                          <img src={b.image} alt={b.name} className='h-24 w-full object-cover' loading='lazy' />
                        ) : (
                          <div className='flex h-24 items-center justify-center bg-gradient-to-br from-[#334155] to-[#0f172a] text-xs font-semibold text-slate-300'>
                            Tournament
                          </div>
                        )}
                      </div>
                      <div className='flex items-start justify-between gap-2'>
                        <p className='line-clamp-2 font-semibold text-white'>{b.name}</p>
                        <span className='shrink-0 rounded bg-slate-500/20 px-1.5 py-0.5 text-[10px] text-slate-300'>PAST</span>
                      </div>
                      <p className='mt-1 text-[11px] text-slate-400'>Rounds: {rounds.length}</p>
                    </button>

                    {isExpanded && (
                      <div className='border-t border-white/10 px-2 py-2'>
                        <p className='mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400'>Rounds</p>
                        {broadcastRoundsLoadingById[broadcastKey(b)] ? (
                          <p className='mb-1 text-[11px] text-slate-500'>Loading all rounds...</p>
                        ) : null}
                        <div className='space-y-1'>
                          {rounds.length === 0 && <p className='text-xs text-slate-500'>No rounds available.</p>}
                          {rounds.map((round) => (
                            <button
                              key={round.id}
                              onClick={() => loadBroadcastRound(b, round.id)}
                              className={`block w-full rounded border px-2 py-1 text-left text-xs transition ${selectedBroadcastRound === round.id ? 'border-cyan-300/70 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-[#252526] text-slate-200 hover:border-white/25'}`}
                            >
                              <div className='flex items-center justify-between gap-2'>
                                <span className='truncate'>{round.name || 'Round'}</span>
                                <span className={`rounded px-1 py-0.5 text-[10px] ${round.ongoing ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300'}`}>
                                  {round.ongoing ? 'LIVE' : 'ROUND'}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </aside>
      )}

      {analysisOnly && !selectedTournamentGame && (
        <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-4 text-sm text-slate-300 backdrop-blur'>
          Loading live game analysis board...
        </section>
      )}

      {isStreamTheaterOpen && selectedStreamerUrl && (
        <div className='fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-3'>
          <div className='w-full max-w-6xl overflow-hidden rounded-xl border border-white/20 bg-[#111]'>
            <div className='flex items-center justify-between border-b border-white/10 px-3 py-2'>
              <p className='truncate text-sm font-semibold text-white'>
                {selectedStreamerMeta?.title || selectedStreamerMeta?.name || activeWatchTitle || 'Live Broadcast'}
              </p>
              <button
                onClick={() => setIsStreamTheaterOpen(false)}
                className='rounded border border-white/20 px-2 py-1 text-xs text-slate-200 transition hover:border-red-300/60 hover:bg-red-500/10'
              >
                Close
              </button>
            </div>
            <iframe
              title='Live broadcast theater view'
              src={selectedStreamerUrl}
              className='h-[72vh] w-full'
              allow='autoplay; encrypted-media; picture-in-picture; fullscreen'
              referrerPolicy='strict-origin-when-cross-origin'
              loading='lazy'
            />
          </div>
        </div>
      )}

      {isMiniPlayerOpen && selectedStreamerUrl && (
        <div
          className='fixed z-[75] w-[360px] overflow-hidden rounded-lg border border-white/20 bg-[#111] shadow-2xl'
          style={{ left: `${miniPlayerPosition.x}px`, top: `${miniPlayerPosition.y}px` }}
        >
          <div
            className='flex cursor-move items-center justify-between border-b border-white/10 bg-[#1a1a1a] px-2 py-1'
            onMouseDown={startMiniDrag}
          >
            <p className='truncate text-xs font-semibold text-slate-200'>Mini Player</p>
            <button
              onClick={() => setIsMiniPlayerOpen(false)}
              className='rounded border border-white/20 px-1.5 py-0.5 text-[10px] text-slate-200 transition hover:border-red-300/60 hover:bg-red-500/10'
            >
              Close
            </button>
          </div>
          <iframe
            title='Live stream mini player'
            src={selectedStreamerUrl}
            className='h-[202px] w-full'
            allow='autoplay; encrypted-media; picture-in-picture; fullscreen'
            referrerPolicy='strict-origin-when-cross-origin'
            loading='lazy'
          />
        </div>
      )}
    </div>
  )
}

export default LichessWatch
