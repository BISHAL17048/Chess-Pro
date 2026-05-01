import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { usePlayStore } from '../store/usePlayStore'
import { BOARD_THEMES, useBoardThemeStore } from '../store/useBoardThemeStore'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { useSoundEffects } from '../hooks/useSoundEffects'
import { getStoredApiToken } from '../utils/authToken'

function isBoardSquare(square) {
  return typeof square === 'string' && /^[a-h][1-8]$/.test(square)
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function normalizeMovesForUI(moveHistory = []) {
  return moveHistory.map((entry) => ({
    san: entry.san || entry.move || '',
    from: entry.from,
    to: entry.to
  }))
}

function normalizeReplayMoves(moveHistory = []) {
  return (Array.isArray(moveHistory) ? moveHistory : [])
    .map((entry) => ({
      san: entry?.san || entry?.move || '',
      from: entry?.from,
      to: entry?.to,
      promotion: entry?.promotion || undefined,
      color: entry?.color === 'white'
        ? 'w'
        : entry?.color === 'black'
          ? 'b'
          : (entry?.color || (entry?.playerColor === 'white' ? 'w' : entry?.playerColor === 'black' ? 'b' : undefined))
    }))
    .filter((entry) => isBoardSquare(entry.from) && isBoardSquare(entry.to))
}

function mapJoinErrorMessage(errorText) {
  const raw = String(errorText || '').trim()
  const text = raw.toLowerCase()

  if (text.includes('cannot join your own') || text.includes('own match') || text.includes('own game')) {
    return 'You cannot join your own match. Use a different account/browser to join.'
  }

  if (text.includes('player is not part of this game')) {
    return 'Join failed: this account is not part of that match.'
  }

  if (text.includes('requested color unavailable')) {
    return 'Selected color is unavailable for this room. Choose Random or the open seat color.'
  }

  return raw || 'Failed to join room'
}

const MATCH_TIME_PRESETS = [
  { id: '1+0', label: '1+0', category: 'bullet', baseTimeMs: 60000, incrementMs: 0 },
  { id: '2+1', label: '2+1', category: 'bullet', baseTimeMs: 120000, incrementMs: 1000 },
  { id: '3+0', label: '3+0', category: 'blitz', baseTimeMs: 180000, incrementMs: 0 },
  { id: '3+2', label: '3+2', category: 'blitz', baseTimeMs: 180000, incrementMs: 2000 },
  { id: '5+0', label: '5+0', category: 'blitz', baseTimeMs: 300000, incrementMs: 0 },
  { id: '10+0', label: '10+0', category: 'rapid', baseTimeMs: 600000, incrementMs: 0 },
  { id: '10+5', label: '10+5', category: 'rapid', baseTimeMs: 600000, incrementMs: 5000 },
  { id: '15+10', label: '15+10', category: 'rapid', baseTimeMs: 900000, incrementMs: 10000 },
  { id: '30+0', label: '30+0', category: 'classical', baseTimeMs: 1800000, incrementMs: 0 },
  { id: '30+20', label: '30+20', category: 'classical', baseTimeMs: 1800000, incrementMs: 20000 }
]

const MATCH_MODES = ['rated', 'casual', 'friend', 'bot', 'tournament']
const COLOR_PREFERENCES = ['random', 'white', 'black']

function ChessBoard({ socket, initialMatchConfig = null, externalJoinGameId = '' }) {

  const themeId = useBoardThemeStore((state) => state.themeId)
  const boardTheme = useMemo(() => BOARD_THEMES.find((theme) => theme.id === themeId) || BOARD_THEMES[0], [themeId])

  const {
    fen,
    moves,
    lastMove,
    chat,
    timers,
    running,
    applyPosition,
    setTimers,
    tickTimer,
    toggleRunning,
    addChatMessage,
    resetBoard,
    loadGameForReview
  } = usePlayStore()
  const setActivePage = useAppStore((state) => state.setActivePage)
  const {
    unlockAudio,
    playMove,
    playOpponentMove,
    playCapture,
    playCastle,
    playCheck,
    playPromotion,
    playIllegal,
    playGameStart,
    playGameEnd,
    playLowTime
  } = useSoundEffects()

  const game = useMemo(() => new Chess(fen), [fen])
  const authUser = useAuthStore((state) => state.user)
  const apiToken = useAuthStore((state) => state.apiToken)
  const [chatInput, setChatInput] = useState('')
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [legalMoves, setLegalMoves] = useState([])
  const [username, setUsername] = useState('')
  const [roomId, setRoomId] = useState('')
  const [roomInput, setRoomInput] = useState('')
  const playerId = useMemo(() => {
    if (authUser?.id) {
      return authUser.id
    }

    if (authUser?.uid) {
      return `u_${authUser.uid}`
    }

    const saved = sessionStorage.getItem('chess_player_id')
    if (saved) return saved

    const generated = `p_${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem('chess_player_id', generated)
    return generated
  }, [authUser?.id, authUser?.uid])
  const [activePlayerId, setActivePlayerId] = useState('')
  const [playerColor, setPlayerColor] = useState('white')
  const [socketStatus, setSocketStatus] = useState('disconnected')
  const [roomStatus, setRoomStatus] = useState('Not in room')
  const [onlineGameStatus, setOnlineGameStatus] = useState('idle')
  const [onlineMode, setOnlineMode] = useState(false)
  const [spectatorMode, setSpectatorMode] = useState(false)
  const [timeControlMinutes, setTimeControlMinutes] = useState(5)
  const [timeControlIncrementSeconds, setTimeControlIncrementSeconds] = useState(0)
  const [timeControlPreset, setTimeControlPreset] = useState('5+0')
  const [timeCategory, setTimeCategory] = useState('blitz')
  const [gameMode, setGameMode] = useState('rated')
  const [colorPreference, setColorPreference] = useState('random')
  const [waitingGames, setWaitingGames] = useState([])
  const [completedGames, setCompletedGames] = useState([])
  const [lobbyLoading, setLobbyLoading] = useState(false)
  const [quickJoinLoading, setQuickJoinLoading] = useState(false)
  const [matchedCountdown, setMatchedCountdown] = useState(0)
  const [showMatchStartAnimation, setShowMatchStartAnimation] = useState(false)
  const [showGameEndAnimation, setShowGameEndAnimation] = useState(false)
  const [gameEndAnimationLabel, setGameEndAnimationLabel] = useState('Game Over')
  const [gameEndAnimationTone, setGameEndAnimationTone] = useState('checkmate')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const [incomingInvites, setIncomingInvites] = useState([])
  const [panelTab, setPanelTab] = useState('new')
  const [drawOffer, setDrawOffer] = useState({ status: 'none', byPlayerId: null, byColor: null })
  const [rematchOffer, setRematchOffer] = useState({ status: 'none', byPlayerId: null, byColor: null })
  const [replaySession, setReplaySession] = useState(null)
  const [replayPly, setReplayPly] = useState(0)
  const [replayAutoplay, setReplayAutoplay] = useState(false)
  const [playerArchiveTarget, setPlayerArchiveTarget] = useState('')
  const [playerArchiveGames, setPlayerArchiveGames] = useState([])
  const [playerArchiveLoading, setPlayerArchiveLoading] = useState(false)
  const [boardWidth, setBoardWidth] = useState(560)
  const [playerNames, setPlayerNames] = useState({
    white: 'White',
    black: 'Black'
  })
  const boardFrameRef = useRef(null)
  const boardAreaRef = useRef(null)
  const lastAppliedMoveRef = useRef('')
  const lastSoundEventRef = useRef('')
  const dragSourceRef = useRef('')
  const roomIdRef = useRef('')
  const lastOnlineStatusRef = useRef('idle')
  const lowTimePlayedRef = useRef({ white: false, black: false })
  const quickJoinAbortRef = useRef(null)
  const lastExternalJoinRef = useRef('')
  const externalJoinBusyRef = useRef(false)
  const matchStartAnimationTimeoutRef = useRef(null)
  const gameEndAnimationTimeoutRef = useRef(null)
  const lastCinematicStatusRef = useRef('idle')
  const lastCinematicRoomRef = useRef('')
  const lastEndCinematicKeyRef = useRef('')

  const activeUsername = (username || authUser?.username || authUser?.displayName || '').trim()
  const sessionPlayerId = activePlayerId || playerId
  const localDisplayName = activeUsername || username || 'You'
  const selectedPresetMeta = useMemo(
    () => MATCH_TIME_PRESETS.find((preset) => preset.id === timeControlPreset) || MATCH_TIME_PRESETS[4],
    [timeControlPreset]
  )
  const authHeaders = useMemo(() => {
    const resolvedToken = String(apiToken || getStoredApiToken() || '').trim()
    const headers = { 'Content-Type': 'application/json' }
    if (resolvedToken) {
      headers.Authorization = `Bearer ${resolvedToken}`
    }
    return headers
  }, [apiToken])

  useEffect(() => {
    const el = boardAreaRef.current
    if (!el) return
    let raf = null
    const compute = () => {
      const w = el.clientWidth || 560
      const h = el.clientHeight || w
      const size = Math.max(220, Math.min(w, h) - 20)
      setBoardWidth(size)
    }
    const observer = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(compute)
    })
    observer.observe(el)
    compute()
    return () => {
      observer.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const lifecycleMeta = useMemo(() => {
    const normalizedStatus = String(onlineGameStatus || 'idle').toLowerCase()
    const roomStatusText = String(roomStatus || '').toLowerCase()

    let state = 'idle'
    if (quickJoinLoading) {
      state = 'seeking'
    } else if (spectatorMode && onlineMode) {
      state = 'spectating'
    } else if (onlineMode && socketStatus !== 'connected') {
      state = 'reconnecting'
    } else if (normalizedStatus === 'completed') {
      state = 'completed'
    } else if (normalizedStatus === 'active') {
      state = 'active'
    } else if (onlineMode && (normalizedStatus === 'waiting' || roomStatusText.includes('waiting'))) {
      state = 'matched'
    } else if (roomStatusText.includes('failed') || roomStatusText.includes('error')) {
      state = 'error'
    }

    const stepIndexByState = {
      idle: 0,
      seeking: 1,
      matched: 2,
      active: 3,
      spectating: 3,
      completed: 4,
      reconnecting: 3,
      error: 0
    }

    const titleByState = {
      idle: 'Ready to Play',
      seeking: 'Searching Opponent',
      matched: 'Match Found',
      active: spectatorMode ? 'Watching Live Game' : 'Game In Progress',
      spectating: 'Watching Live Game',
      completed: 'Game Finished',
      reconnecting: 'Reconnecting',
      error: 'Action Needed'
    }

    const hintByState = {
      idle: 'Pick a mode and start matchmaking.',
      seeking: 'Finding the best available room...',
      matched: 'Seat reserved. Waiting for game start.',
      active: spectatorMode ? 'Follow moves in real time.' : 'Play your best moves.',
      spectating: 'Follow moves in real time.',
      completed: 'Review or start a new game.',
      reconnecting: 'Trying to restore live session...',
      error: 'Match request failed. Try again.'
    }

    const toneByState = {
      idle: 'text-slate-300 border-white/15 bg-white/5',
      seeking: 'text-cyan-200 border-cyan-300/40 bg-cyan-500/10',
      matched: 'text-amber-200 border-amber-300/40 bg-amber-500/10',
      active: 'text-emerald-200 border-emerald-300/40 bg-emerald-500/10',
      spectating: 'text-sky-200 border-sky-300/40 bg-sky-500/10',
      completed: 'text-indigo-200 border-indigo-300/40 bg-indigo-500/10',
      reconnecting: 'text-orange-200 border-orange-300/40 bg-orange-500/10',
      error: 'text-red-200 border-red-300/40 bg-red-500/10'
    }

    const dynamicTitle = state === 'matched' && matchedCountdown > 0
      ? `Match Found - ${matchedCountdown}s`
      : (titleByState[state] || 'Ready to Play')

    const dynamicHint = state === 'matched' && matchedCountdown > 0
      ? 'Opponent connected. Syncing clocks and board...'
      : (hintByState[state] || 'Pick a mode and start matchmaking.')

    return {
      state,
      stepIndex: stepIndexByState[state] ?? 0,
      title: dynamicTitle,
      hint: dynamicHint,
      tone: toneByState[state] || 'text-slate-300 border-white/15 bg-white/5'
    }
  }, [onlineGameStatus, roomStatus, quickJoinLoading, spectatorMode, onlineMode, socketStatus, matchedCountdown])

  useEffect(() => {
    if (lifecycleMeta.state !== 'matched') {
      setMatchedCountdown(0)
      return undefined
    }

    setMatchedCountdown((current) => (current > 0 ? current : 5))

    const timer = setInterval(() => {
      setMatchedCountdown((current) => (current > 0 ? current - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [lifecycleMeta.state])

  const triggerMatchStartCinematic = useCallback(() => {
    const activeRoom = roomIdRef.current || roomId
    const cinematicRoomKey = String(activeRoom || 'online-session')
    if (lastCinematicRoomRef.current === cinematicRoomKey) {
      return
    }

    lastCinematicRoomRef.current = cinematicRoomKey
    playGameStart()
    setShowMatchStartAnimation(true)

    if (matchStartAnimationTimeoutRef.current) {
      clearTimeout(matchStartAnimationTimeoutRef.current)
    }

    matchStartAnimationTimeoutRef.current = setTimeout(() => {
      setShowMatchStartAnimation(false)
    }, 1700)
  }, [playGameStart, roomId])

  const resolveEndCinematicMeta = useCallback((result, reason) => {
    const normalizedReason = String(reason || '').toLowerCase()
    const normalizedResult = String(result || '').toLowerCase()

    if (normalizedReason.includes('resign')) {
      return {
        label: 'Resign',
        tone: 'resign'
      }
    }

    if (normalizedReason.includes('checkmate')) {
      return {
        label: 'Checkmate',
        tone: 'checkmate'
      }
    }

    if ((normalizedResult === 'white-win' || normalizedResult === 'black-win') && !normalizedReason) {
      return {
        label: 'Checkmate',
        tone: 'checkmate'
      }
    }

    if (normalizedReason.includes('timeout') || normalizedResult.includes('timeout')) {
      return {
        label: 'Time Out',
        tone: 'timeout'
      }
    }

    if (normalizedReason.includes('stalemate') || normalizedResult === 'stalemate') {
      return {
        label: 'Stalemate',
        tone: 'draw'
      }
    }

    if (normalizedReason.includes('draw') || normalizedResult === 'draw') {
      return {
        label: 'Draw',
        tone: 'draw'
      }
    }

    return {
      label: 'Game Over',
      tone: 'checkmate'
    }
  }, [])

  const triggerGameEndCinematic = useCallback((result, reason, gameId = '') => {
    const baseKey = String(gameId || roomIdRef.current || roomId || 'game')
    const effectKey = `${baseKey}:${String(result || '')}:${String(reason || '')}`
    if (lastEndCinematicKeyRef.current === effectKey) {
      return
    }

    lastEndCinematicKeyRef.current = effectKey
    const meta = resolveEndCinematicMeta(result, reason)
    setGameEndAnimationLabel(meta.label)
    setGameEndAnimationTone(meta.tone)
    setShowGameEndAnimation(true)
    playGameEnd()

    if (gameEndAnimationTimeoutRef.current) {
      clearTimeout(gameEndAnimationTimeoutRef.current)
    }

    gameEndAnimationTimeoutRef.current = setTimeout(() => {
      setShowGameEndAnimation(false)
    }, 2300)
  }, [playGameEnd, resolveEndCinematicMeta, roomId])

  useEffect(() => {
    const nextStatus = String(onlineGameStatus || 'idle').toLowerCase()
    const prevStatus = lastCinematicStatusRef.current

    if (onlineMode && prevStatus !== 'active' && nextStatus === 'active') {
      triggerMatchStartCinematic()
    }

    if (nextStatus !== 'active') {
      lastCinematicRoomRef.current = ''
    }

    if (nextStatus === 'completed') {
      setShowMatchStartAnimation(false)
    }

    lastCinematicStatusRef.current = nextStatus
  }, [onlineMode, onlineGameStatus, triggerMatchStartCinematic])

  useEffect(() => {
    return () => {
      if (matchStartAnimationTimeoutRef.current) {
        clearTimeout(matchStartAnimationTimeoutRef.current)
      }

      if (gameEndAnimationTimeoutRef.current) {
        clearTimeout(gameEndAnimationTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!playerId) return
    setActivePlayerId(playerId)
  }, [playerId])

  useEffect(() => {
    const incomingControl = initialMatchConfig?.timeControl || null
    const incomingMode = String(initialMatchConfig?.gameMode || '').toLowerCase()
    const incomingColorPreference = String(initialMatchConfig?.colorPreference || '').toLowerCase()

    if (incomingControl?.preset) {
      const matched = MATCH_TIME_PRESETS.find((preset) => preset.id === incomingControl.preset)
      if (matched) {
        setTimeControlPreset(matched.id)
        setTimeControlMinutes(Math.max(1, Math.floor(matched.baseTimeMs / 60000)))
        setTimeControlIncrementSeconds(Math.max(0, Math.floor(matched.incrementMs / 1000)))
        setTimeCategory(matched.category)
      }
    }

    if (MATCH_MODES.includes(incomingMode)) {
      setGameMode(incomingMode)
    }

    if (COLOR_PREFERENCES.includes(incomingColorPreference)) {
      setColorPreference(incomingColorPreference)
    }
  }, [initialMatchConfig])

  useEffect(() => {
    return () => {
      if (quickJoinAbortRef.current) {
        quickJoinAbortRef.current.abort()
        quickJoinAbortRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (username.trim()) return
    const suggested = (authUser?.username || authUser?.displayName || '').trim()
    if (suggested) {
      setUsername(suggested)
    }
  }, [authUser?.username, authUser?.displayName, username])

  const applyPlayerNames = (players) => {
    if (!players) return

    setPlayerNames((current) => ({
      white: players?.white?.username || current.white,
      black: players?.black?.username || current.black
    }))
  }

  const whiteName = playerNames.white || 'White'
  const blackName = playerNames.black || 'Black'
  const yourSideColor = onlineMode
    ? (playerColor === 'black' ? 'black' : 'white')
    : 'white'
  const opponentSideColor = yourSideColor === 'white' ? 'black' : 'white'
  const boardOrientation = yourSideColor === 'black' ? 'black' : 'white'
  const topClockSeconds = opponentSideColor === 'white' ? timers.white : timers.black
  const bottomClockSeconds = yourSideColor === 'white' ? timers.white : timers.black
  const youName = onlineMode
    ? playerColor === 'black'
      ? blackName
      : whiteName
    : localDisplayName
  const opponentName = onlineMode
    ? playerColor === 'black'
      ? whiteName
      : blackName
    : 'Opponent'

  const turn = game.turn() === 'w' ? 'white' : 'black'
  // Allow moves when game is active OR when socket is reconnecting (queue moves until connected)
  const canMoveOnline = !spectatorMode && (onlineGameStatus === 'active' || onlineGameStatus === 'waiting') && turn === playerColor

  const playMoveByMeta = useCallback((meta, isOpponentMove = false) => {
    const san = String(meta?.san || meta?.move || '')
    const isCastle = san === 'O-O' || san === 'O-O-O'
    const isPromotion = san.includes('=') || Boolean(meta?.promotion)
    const isCapture = Boolean(meta?.captured)

    if (isPromotion) {
      playPromotion()
      return
    }

    if (isCastle) {
      playCastle()
      return
    }

    if (isCapture) {
      playCapture()
      return
    }

    if (isOpponentMove) {
      playOpponentMove()
      return
    }

    playMove()
  }, [playMove, playOpponentMove, playCapture, playCastle, playPromotion])

  const clearSelection = () => {
    setSelectedSquare(null)
    setLegalMoves([])
  }

  const calculateLegalMoves = (square) => {
    const verboseMoves = game.moves({ square, verbose: true })
    return verboseMoves.map((move) => move.to)
  }

  const selectSquare = (square) => {
    const piece = game.get(square)
    if (!piece) {
      clearSelection()
      return
    }

    if (piece.color !== game.turn()) {
      setRoomStatus(`It is ${turn} to move`)
      clearSelection()
      return
    }

    setSelectedSquare(square)
    setLegalMoves(calculateLegalMoves(square))
  }

  useEffect(() => {
    if (onlineMode) return undefined
    if (!running || game.isGameOver() || moves.length === 0) return undefined

    const timer = setInterval(() => {
      tickTimer(turn)
    }, 1000)

    return () => clearInterval(timer)
  }, [turn, running, game, tickTimer, onlineMode, moves.length])

  useEffect(() => {
    if (!socket || !onlineMode || !roomId) return undefined

    const syncInterval = setInterval(() => {
      const activeRoom = roomIdRef.current || roomId
      if (!activeRoom) return
      socket.emit('get-board', { gameId: activeRoom })
    }, 1000)

    return () => clearInterval(syncInterval)
  }, [socket, onlineMode, roomId])

  const applyOnlineSession = (sessionData, statusText) => {
    const nextRoomId = sessionData?.gameId
    if (!nextRoomId) {
      setRoomStatus('Invalid live game response')
      return
    }

    setRoomId(nextRoomId)
    roomIdRef.current = nextRoomId
    setRoomInput(nextRoomId)
    setPlayerColor(sessionData.playerColor || 'white')
    setActivePlayerId(String(sessionData.playerId || playerId || ''))
    setSpectatorMode(false)
    setOnlineMode(true)
    setOnlineGameStatus(sessionData.status || 'waiting')
    lastOnlineStatusRef.current = sessionData.status || 'waiting'
    lowTimePlayedRef.current = { white: false, black: false }
    setDrawOffer(sessionData.drawOffer || { status: 'none', byPlayerId: null, byColor: null })
    setRematchOffer(sessionData.rematchOffer || { status: 'none', byPlayerId: null, byColor: null })
    if (sessionData.timers) {
      setTimers(sessionData.timers)
    }
    applyPlayerNames(sessionData.players)
    setRoomStatus(statusText)

    socket?.emit('joinGame', { gameId: nextRoomId, playerId: String(sessionData.playerId || sessionPlayerId || '') })
    socket?.emit('get-board', { gameId: nextRoomId })
  }

  const fetchWaitingGames = async () => {
    try {
      setLobbyLoading(true)
      const response = await fetch('/api/game')
      const payload = await response.json()
      if (!payload.success) {
        setWaitingGames([])
        return
      }

      const rows = (payload.data || []).filter((g) => g?.whitePlayer && (g.status === 'waiting' || g.status === 'active'))
      setWaitingGames(rows)
    } catch {
      setWaitingGames([])
    } finally {
      setLobbyLoading(false)
    }
  }

  const fetchCompletedGames = async () => {
    try {
      const response = await fetch('/api/game/completed?max=20', {
        headers: authHeaders
      })
      const payload = await response.json()
      if (!payload.success) {
        setCompletedGames([])
        return
      }
      setCompletedGames(payload.data || [])
    } catch {
      setCompletedGames([])
    }
  }

  const fetchCompletedGamesByUsername = async (targetUsername) => {
    const safeName = String(targetUsername || '').trim()
    if (!safeName) return

    setPlayerArchiveTarget(safeName)
    setPlayerArchiveLoading(true)
    try {
      const response = await fetch(`/api/game/completed/by-username/${encodeURIComponent(safeName)}?max=30`)
      const payload = await response.json()
      if (!payload.success) {
        setPlayerArchiveGames([])
        return
      }
      setPlayerArchiveGames(Array.isArray(payload.data) ? payload.data : [])
    } catch {
      setPlayerArchiveGames([])
    } finally {
      setPlayerArchiveLoading(false)
    }
  }

  useEffect(() => {
    if (onlineMode) return undefined

    fetchWaitingGames()
    fetchCompletedGames()
    const interval = setInterval(fetchWaitingGames, 5000)
    const completedInterval = setInterval(fetchCompletedGames, 8000)
    return () => {
      clearInterval(interval)
      clearInterval(completedInterval)
    }
  }, [onlineMode, authHeaders])

  useEffect(() => {
    if (!socket) return undefined

    const handleConnect = () => {
      setSocketStatus('connected')
      const activeRoom = roomIdRef.current || roomId
      if (activeRoom && !spectatorMode) {
        socket.emit('joinGame', { gameId: activeRoom, playerId: sessionPlayerId })
      }
      if (activeRoom) {
        socket.emit('get-board', { gameId: activeRoom })
      }
    }

    const handleDisconnect = () => {
      setSocketStatus('disconnected')
      if (onlineMode) setRoomStatus('Disconnected. Reconnecting...')
    }

    const handleBoardState = (payload) => {
      if (!payload || payload.gameId !== roomIdRef.current) return

      const board = payload.board
      if (board?.fen) {
        applyPosition({
          fen: board.fen,
          moves: normalizeMovesForUI(board.moves),
          lastMove: null
        })
      }

      if (board?.timers) {
        setTimers(board.timers)
      }

      if (payload.playerColor) {
        setPlayerColor(payload.playerColor)
      }

      applyPlayerNames(payload.players || payload.gameState?.players)
      const nextStatus = board?.status || payload?.gameState?.status || 'waiting'
      lastOnlineStatusRef.current = nextStatus
      setOnlineGameStatus(nextStatus)
      setDrawOffer(board?.drawOffer || payload?.gameState?.drawOffer || { status: 'none', byPlayerId: null, byColor: null })
      setRematchOffer(board?.rematchOffer || payload?.gameState?.rematchOffer || { status: 'none', byPlayerId: null, byColor: null })

      const drawPattern = board?.drawDetection || payload?.gameState?.drawDetection

      if (board?.status === 'completed') {
        setRoomStatus(`Game ended: ${board.result || 'completed'}`)
        triggerGameEndCinematic(board.result, board.reason, payload.gameId)
      } else if (drawPattern?.is_draw && !drawPattern?.automatic) {
        setRoomStatus(`Draw pattern detected: ${drawPattern.type} (claimable)`)
      } else if (board?.status === 'waiting') {
        setRoomStatus('Waiting for opponent to join...')
      } else {
        setRoomStatus('Synced')
      }
    }

    const handleMoveMade = (payload) => {
      if (!payload || payload.gameId !== roomIdRef.current) return

      const soundEventKey = `${payload.gameId}:${payload.from}-${payload.to}:${payload.fen || ''}`
      const shouldPlayMoveSound = lastSoundEventRef.current !== soundEventKey
      if (shouldPlayMoveSound) {
        lastSoundEventRef.current = soundEventKey
      }

      const latestMove = Array.isArray(payload.moveHistory)
        ? payload.moveHistory[payload.moveHistory.length - 1]
        : null
      const isOpponentMove = payload.playerColor && payload.playerColor !== playerColor
      if (shouldPlayMoveSound) {
        playMoveByMeta(latestMove, Boolean(isOpponentMove))
      }

      applyPosition({
        fen: payload.fen,
        moves: normalizeMovesForUI(payload.moveHistory),
        lastMove: { from: payload.from, to: payload.to }
      })

      try {
        const postMove = new Chess(payload.fen)
        if (shouldPlayMoveSound && postMove.isCheck()) {
          playCheck()
        }
      } catch {
        // Ignore sound-only parse failures.
      }

      if (payload.timers) {
        setTimers(payload.timers)
      }

      if (payload.status) {
        setOnlineGameStatus(payload.status)
      }

      if (payload?.drawDetection?.is_draw && !payload?.drawDetection?.automatic && payload.status !== 'completed') {
        setRoomStatus(`Draw pattern detected: ${payload.drawDetection.type} (claimable)`)
      }

      if (payload.status === 'completed') {
        setRoomStatus(`Game ended: ${payload.result || 'completed'}`)
        triggerGameEndCinematic(payload.result, payload.reason, payload.gameId)
      }
    }

    const handlePlayerJoined = (payload) => {
      if (!payload || payload.gameId !== roomIdRef.current) return
      applyPlayerNames(payload.gameState?.players)
      setRoomStatus('Opponent joined')
    }

    const handlePlayerDisconnected = (payload) => {
      if (!payload || payload.gameId !== roomIdRef.current) return
      setRoomStatus('Opponent disconnected (waiting for reconnect)')
    }

    const handlePlayerReconnected = (payload) => {
      if (!payload || payload.gameId !== roomIdRef.current) return
      setRoomStatus('Opponent reconnected')
      socket.emit('get-board', { gameId: roomIdRef.current })
    }

    const handleMoveInvalid = (payload) => {
      setRoomStatus(payload?.error || 'Invalid move')
      playIllegal()
      if (roomIdRef.current) socket.emit('get-board', { gameId: roomIdRef.current })
    }

    const handleSocketError = (payload) => {
      const message = typeof payload === 'string' ? payload : payload?.message
      setRoomStatus(mapJoinErrorMessage(message || 'Socket error'))
    }

    const handleDrawOffered = (payload) => {
      if (!payload || payload.gameId !== roomIdRef.current) return
      const next = payload.drawOffer || { status: 'none', byPlayerId: null, byColor: null }
      setDrawOffer(next)
      if (next.status === 'pending') {
        if (next.byPlayerId === sessionPlayerId) {
          setRoomStatus('Draw offer sent')
        } else {
          setRoomStatus('Opponent offered a draw')
        }
      } else {
        setRoomStatus('Draw offer cleared')
      }
    }

    const handleRematchOffered = (payload) => {
      if (!payload || payload.gameId !== roomIdRef.current) return
      const next = payload.rematchOffer || { status: 'none', byPlayerId: null, byColor: null }
      setRematchOffer(next)
      if (next.status === 'pending') {
        if (next.byPlayerId === sessionPlayerId) {
          setRoomStatus('Rematch offer sent')
        } else {
          setRoomStatus('Opponent wants a rematch')
        }
      }
    }

    const handleRematchCreated = (payload) => {
      const session = payload?.session
      if (!session?.gameId) return
      const playerColorFromSession = session.playerColors?.[sessionPlayerId] || 'white'
      applyOnlineSession(
        {
          ...session,
          playerColor: playerColorFromSession,
          drawOffer: { status: 'none', byPlayerId: null, byColor: null },
          rematchOffer: { status: 'none', byPlayerId: null, byColor: null }
        },
        'Rematch started'
      )
    }

    const handleGameEnded = (payload) => {
      if (!payload || payload.gameId !== roomIdRef.current) return
      setRoomStatus(`Game ended: ${payload.result || payload.reason || 'completed'}`)
      triggerGameEndCinematic(payload.result, payload.reason, payload.gameId)
      fetchCompletedGames()
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('board-state', handleBoardState)
    socket.on('move-made', handleMoveMade)
    socket.on('player-joined', handlePlayerJoined)
    socket.on('player-disconnected', handlePlayerDisconnected)
    socket.on('player-reconnected', handlePlayerReconnected)
    socket.on('move-invalid', handleMoveInvalid)
    socket.on('error', handleSocketError)
    socket.on('game-ended', handleGameEnded)
    socket.on('draw-offered', handleDrawOffered)
    socket.on('rematch-offered', handleRematchOffered)
    socket.on('rematch-created', handleRematchCreated)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('board-state', handleBoardState)
      socket.off('move-made', handleMoveMade)
      socket.off('player-joined', handlePlayerJoined)
      socket.off('player-disconnected', handlePlayerDisconnected)
      socket.off('player-reconnected', handlePlayerReconnected)
      socket.off('move-invalid', handleMoveInvalid)
      socket.off('error', handleSocketError)
      socket.off('game-ended', handleGameEnded)
      socket.off('draw-offered', handleDrawOffered)
      socket.off('rematch-offered', handleRematchOffered)
      socket.off('rematch-created', handleRematchCreated)
    }
  }, [socket, roomId, sessionPlayerId, playerColor, onlineMode, spectatorMode, applyPosition, setTimers, playMoveByMeta, playCheck, playIllegal, playGameStart, triggerGameEndCinematic])

  useEffect(() => {
    if (!onlineMode || onlineGameStatus !== 'active') return

    const hitWhiteLow = timers.white > 0 && timers.white <= 10
    const hitBlackLow = timers.black > 0 && timers.black <= 10

    if (hitWhiteLow && !lowTimePlayedRef.current.white) {
      lowTimePlayedRef.current.white = true
      playLowTime()
    }

    if (hitBlackLow && !lowTimePlayedRef.current.black) {
      lowTimePlayedRef.current.black = true
      playLowTime()
    }
  }, [onlineMode, onlineGameStatus, timers.white, timers.black, playLowTime])

  useEffect(() => {
    if (!socket) return undefined

    const register = () => {
      if (!authUser?.email) return
      socket.emit('register-user', {
        email: authUser.email,
        playerId: sessionPlayerId
      })
    }

    const handleConnect = () => register()
    const handleInvite = (payload) => {
      if (!payload?.gameId) return
      setIncomingInvites((current) => {
        const exists = current.some((row) => row.inviteId === payload.inviteId)
        if (exists) return current
        return [payload, ...current].slice(0, 5)
      })
    }

    const handleInviteStatus = (payload) => {
      if (!payload) return
      if (payload.ok) {
        setInviteStatus(`Invite sent to ${payload.deliveredTo}`)
      } else {
        const reason = payload.reason || 'Invite failed'
        setInviteStatus(`${reason}. Ask friend to log in with the same email and open Play.`)
      }
    }

    register()
    socket.on('connect', handleConnect)
    socket.on('match-invite', handleInvite)
    socket.on('invite-status', handleInviteStatus)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('match-invite', handleInvite)
      socket.off('invite-status', handleInviteStatus)
    }
  }, [socket, activeUsername, sessionPlayerId, authUser?.email])

  const createRoom = async () => {
    try {
      const response = await fetch('/api/game/create', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          playerId: sessionPlayerId,
          username: username || undefined,
          colorPreference,
          timeControlMinutes,
          gameMode,
          timeControl: {
            preset: timeControlPreset,
            category: timeCategory,
            baseTimeMs: timeControlMinutes * 60000,
            incrementMs: timeControlIncrementSeconds * 1000
          }
        })
      })

      const payload = await response.json()
      if (!payload.success) {
        setRoomStatus(payload.error || 'Failed to create room')
        return
      }

      applyOnlineSession(payload.data, 'Room created. Waiting for opponent...')
    } catch (error) {
      setRoomStatus('Failed to create room')
    }
  }

  const quickJoinLiveGame = async () => {
    if (quickJoinLoading) return

    if (gameMode === 'friend') {
      await createRoom()
      return
    }

    if (gameMode === 'bot') {
      setRoomStatus('Opening Learn vs Bot...')
      setActivePage('learn')
      return
    }

    if (gameMode === 'tournament') {
      setRoomStatus('Opening tournament watch...')
      setActivePage('watch')
      return
    }

    const controller = new AbortController()
    quickJoinAbortRef.current = controller

    try {
      setQuickJoinLoading(true)
      setRoomStatus('Searching live games...')
      const requestQuickJoin = async (requestedColor) => {
        const response = await fetch('/api/game/quick-join', {
          method: 'POST',
          headers: authHeaders,
          signal: controller.signal,
          body: JSON.stringify({
            playerId: sessionPlayerId,
            username: username || undefined,
            colorPreference: requestedColor,
            timeControlMinutes,
            gameMode,
            timeControl: {
              preset: timeControlPreset,
              category: timeCategory,
              baseTimeMs: timeControlMinutes * 60000,
              incrementMs: timeControlIncrementSeconds * 1000
            }
          })
        })

        return response.json()
      }

      let payload = await requestQuickJoin(colorPreference)
      if (!payload.success && String(payload.error || '').toLowerCase().includes('requested color unavailable') && colorPreference !== 'random') {
        setRoomStatus('Selected color is full. Retrying with random seat...')
        payload = await requestQuickJoin('random')
      }

      if (!payload.success) {
        setRoomStatus(mapJoinErrorMessage(payload.error || 'Failed to find live game'))
        return
      }

      const statusText = payload.action === 'joined'
        ? 'Matched! Joined a live game.'
        : 'No open game found. Created a new live room.'
      applyOnlineSession(payload.data, statusText)
    } catch (error) {
      if (error?.name === 'AbortError') {
        setRoomStatus('Matchmaking canceled')
        return
      }
      setRoomStatus('Failed to quick-join live game')
    } finally {
      if (quickJoinAbortRef.current === controller) {
        quickJoinAbortRef.current = null
      }
      setQuickJoinLoading(false)
    }
  }

  const cancelQuickJoinSearch = () => {
    if (!quickJoinAbortRef.current) return
    quickJoinAbortRef.current.abort()
    quickJoinAbortRef.current = null
    setQuickJoinLoading(false)
    if (!roomIdRef.current) {
      setOnlineGameStatus('idle')
      setOnlineMode(false)
    }
    setRoomStatus('Matchmaking canceled')
  }

  const joinFromLobby = async (gameId, requestedColor = colorPreference) => {
    if (!gameId) return
    setRoomInput(gameId)

    try {
      const response = await fetch('/api/game/join', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          gameId,
          playerId: sessionPlayerId,
          username: username || undefined,
          colorPreference: requestedColor,
          gameMode,
          timeControl: {
            preset: timeControlPreset,
            category: timeCategory,
            baseTimeMs: timeControlMinutes * 60000,
            incrementMs: timeControlIncrementSeconds * 1000
          }
        })
      })

      const payload = await response.json()
      if (!payload.success) {
        if (requestedColor !== 'random' && String(payload.error || '').toLowerCase().includes('requested color unavailable')) {
          setRoomStatus('Selected color unavailable in this room. Retrying with random seat...')
          await joinFromLobby(gameId, 'random')
          return
        }
        setRoomStatus(mapJoinErrorMessage(payload.error || 'Failed to join room'))
        return
      }

      applyOnlineSession(payload.data, 'Joined room')
    } catch {
      setRoomStatus('Failed to join room')
    }
  }

  useEffect(() => {
    const nextGameId = String(externalJoinGameId || '').trim()
    if (!nextGameId) return
    if (externalJoinBusyRef.current) return
    if (nextGameId === roomIdRef.current) return
    if (nextGameId === lastExternalJoinRef.current) return

    externalJoinBusyRef.current = true
    lastExternalJoinRef.current = nextGameId
    setRoomStatus('Tournament pairing found. Joining board...')

    joinFromLobby(nextGameId, 'random')
      .finally(() => {
        externalJoinBusyRef.current = false
      })
  }, [externalJoinGameId])

  const watchLiveGame = (gameId) => {
    if (!gameId || !socket) return
    setRoomId(gameId)
    roomIdRef.current = gameId
    setRoomInput(gameId)
    setSpectatorMode(true)
    setOnlineMode(true)
    setOnlineGameStatus('active')
    setPlayerColor('spectator')
    setRoomStatus('Watching live game')
    socket.emit('get-board', { gameId })
  }

  const watchCompletedReplay = (gameRow, autoplay = true) => {
    if (!gameRow) return

    const initialFen = String(gameRow.initialFen || new Chess().fen())
    const replayMoves = normalizeReplayMoves(gameRow.moves)
    setReplaySession({
      gameId: String(gameRow.gameId || ''),
      whitePlayer: gameRow.whitePlayer || 'White',
      blackPlayer: gameRow.blackPlayer || 'Black',
      result: gameRow.result || null,
      reason: gameRow.reason || null,
      initialFen,
      moves: replayMoves,
      endedAt: gameRow.endedAt || null
    })
    setReplayPly(0)
    setReplayAutoplay(Boolean(autoplay))
    setOnlineMode(false)
    setSpectatorMode(false)
    setOnlineGameStatus('completed')
    setRoomStatus(`Watching replay: ${(gameRow.whitePlayer || 'White')} vs ${(gameRow.blackPlayer || 'Black')}`)
    applyPlayerNames({
      white: { username: gameRow.whitePlayer || 'White' },
      black: { username: gameRow.blackPlayer || 'Black' }
    })
    setPanelTab('games')
  }

  const resignCurrentGame = () => {
    if (!socket || !roomIdRef.current || spectatorMode) return
    socket.emit('resign', {
      gameId: roomIdRef.current,
      playerId: sessionPlayerId
    })
  }

  const drawCurrentGame = async () => {
    if (!roomIdRef.current || spectatorMode || !socket) return

    if (drawOffer.status === 'pending' && drawOffer.byPlayerId && drawOffer.byPlayerId !== sessionPlayerId) {
      socket.emit('draw-response', {
        gameId: roomIdRef.current,
        playerId: sessionPlayerId,
        accept: true
      })
      return
    }

    if (drawOffer.status === 'pending' && drawOffer.byPlayerId === sessionPlayerId) {
      setRoomStatus('Waiting for opponent to accept draw')
      return
    }

    socket.emit('draw-offer', {
      gameId: roomIdRef.current,
      playerId: sessionPlayerId
    })
  }

  const declineDrawOffer = () => {
    if (!roomIdRef.current || spectatorMode || !socket) return
    if (drawOffer.status !== 'pending' || drawOffer.byPlayerId === sessionPlayerId) return

    socket.emit('draw-response', {
      gameId: roomIdRef.current,
      playerId: sessionPlayerId,
      accept: false
    })
  }

  const requestRematch = () => {
    if (!roomIdRef.current || spectatorMode || !socket || onlineGameStatus !== 'completed') return
    socket.emit('rematch-offer', {
      gameId: roomIdRef.current,
      playerId: sessionPlayerId
    })
  }

  const analyzeCompletedGame = (gameRow) => {
    if (!gameRow) return

    loadGameForReview({
      gameId: gameRow.gameId,
      whitePlayer: gameRow.whitePlayer,
      blackPlayer: gameRow.blackPlayer,
      whiteEmail: gameRow.whiteEmail,
      blackEmail: gameRow.blackEmail,
      pgn: gameRow.pgn,
      endedAt: gameRow.endedAt,
      result: gameRow.result,
      reason: gameRow.reason,
      initialFen: gameRow.initialFen,
      fen: gameRow.fen,
      moves: Array.isArray(gameRow.moves)
        ? gameRow.moves.map((m) => ({
            san: m.san || m.move || '',
            from: m.from,
            to: m.to,
            color: m.color === 'white'
              ? 'w'
              : m.color === 'black'
                ? 'b'
                : (m.color || (m.playerColor === 'white' ? 'w' : m.playerColor === 'black' ? 'b' : undefined)),
            promotion: m.promotion || undefined
          }))
        : []
    })
    setActivePage('news')
  }

  const replayLatestCompletedGame = async () => {
    try {
      const response = await fetch('/api/game/completed?max=20', {
        headers: authHeaders
      })
      const payload = await response.json()
      if (!payload?.success || !Array.isArray(payload?.data) || payload.data.length === 0) {
        setRoomStatus('No completed games available yet')
        return
      }

      const activeRoom = roomIdRef.current || roomId
      const matched = payload.data.find((row) => String(row?.gameId || '') === String(activeRoom || ''))
      watchCompletedReplay(matched || payload.data[0], true)
    } catch {
      setRoomStatus('Failed to load completed game replay')
    }
  }

  const analyzeLatestCompletedGame = async () => {
    try {
      const response = await fetch('/api/game/completed?max=20', {
        headers: authHeaders
      })
      const payload = await response.json()
      if (!payload?.success || !Array.isArray(payload?.data) || payload.data.length === 0) {
        setRoomStatus('No completed games available to analyze yet')
        return
      }

      const activeRoom = roomIdRef.current || roomId
      const matched = payload.data.find((row) => String(row?.gameId || '') === String(activeRoom || ''))
      analyzeCompletedGame(matched || payload.data[0])
    } catch {
      setRoomStatus('Failed to load completed game analysis')
    }
  }

  useEffect(() => {
    if (!replaySession) return

    const replay = new Chess(replaySession.initialFen || new Chess().fen())
    const capped = Math.max(0, Math.min(replayPly, replaySession.moves.length))

    for (let i = 0; i < capped; i += 1) {
      const move = replaySession.moves[i]
      try {
        replay.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion || 'q'
        })
      } catch {
        break
      }
    }

    const history = replay.history({ verbose: true })
    const last = history.length ? history[history.length - 1] : null
    applyPosition({
      fen: replay.fen(),
      moves: normalizeMovesForUI(history),
      lastMove: last ? { from: last.from, to: last.to } : null
    })
  }, [replaySession, replayPly, applyPosition])

  useEffect(() => {
    if (!replaySession || !replayAutoplay) return undefined
    if (replayPly >= replaySession.moves.length) {
      setReplayAutoplay(false)
      return undefined
    }

    const timer = setInterval(() => {
      setReplayPly((current) => {
        const next = Math.min((replaySession?.moves?.length || 0), current + 1)
        if (next >= (replaySession?.moves?.length || 0)) {
          setReplayAutoplay(false)
        }
        return next
      })
    }, 850)

    return () => clearInterval(timer)
  }, [replaySession, replayAutoplay, replayPly])

  const openUsernameArchive = (targetUsername) => {
    const safeName = String(targetUsername || '').trim()
    if (!safeName) return
    setPanelTab('players')
    fetchCompletedGamesByUsername(safeName)
  }

  const stopReplay = () => {
    setReplayAutoplay(false)
    setReplaySession(null)
    setReplayPly(0)
    setRoomStatus('Replay closed')
  }

  const sendUserInvite = async () => {
    if (!socket) {
      setInviteStatus('Live socket is disconnected')
      return
    }

    const target = inviteEmail.trim().toLowerCase()
    if (!target) {
      setInviteStatus('Enter an email to invite')
      return
    }

    const isLikelyEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)
    if (!isLikelyEmail) {
      setInviteStatus('Please enter a valid email address')
      return
    }

    let targetGameId = roomIdRef.current || roomId

    if (!targetGameId) {
      try {
        setInviteStatus('Creating room...')
        const response = await fetch('/api/game/create', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            playerId: sessionPlayerId,
            username: username || undefined,
            colorPreference,
            timeControlMinutes,
            gameMode,
            timeControl: {
              preset: timeControlPreset,
              category: timeCategory,
              baseTimeMs: timeControlMinutes * 60000,
              incrementMs: timeControlIncrementSeconds * 1000
            }
          })
        })

        const payload = await response.json()
        if (!payload.success) {
          setInviteStatus(payload.error || 'Failed to create room for invite')
          return
        }

        applyOnlineSession(payload.data, 'Room created for friend invite')
        targetGameId = payload.data?.gameId
      } catch {
        setInviteStatus('Failed to create room for invite')
        return
      }
    }

    socket.emit('invite-user', {
      toEmail: target,
      fromEmail: String(authUser?.email || '').trim().toLowerCase(),
      fromUsername: activeUsername || username || 'Player',
      gameId: targetGameId
    })

    setInviteStatus('Sending invite...')
  }

  const acceptInvite = async (invite) => {
    if (!invite?.gameId) return
    await joinFromLobby(invite.gameId)
    setIncomingInvites((current) => current.filter((row) => row.inviteId !== invite.inviteId))
  }

  const joinRoom = async () => {
    if (!roomInput.trim()) {
      setRoomStatus('Enter a room ID first')
      return
    }

    try {
      const response = await fetch('/api/game/join', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          gameId: roomInput.trim(),
          playerId: sessionPlayerId,
          username: username || undefined,
          colorPreference,
          gameMode,
          timeControl: {
            preset: timeControlPreset,
            category: timeCategory,
            baseTimeMs: timeControlMinutes * 60000,
            incrementMs: timeControlIncrementSeconds * 1000
          }
        })
      })

      const payload = await response.json()
      if (!payload.success) {
        if (colorPreference !== 'random' && String(payload.error || '').toLowerCase().includes('requested color unavailable')) {
          const retryResponse = await fetch('/api/game/join', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              gameId: roomInput.trim(),
              playerId: sessionPlayerId,
              username: username || undefined,
              colorPreference: 'random',
              gameMode,
              timeControl: {
                preset: timeControlPreset,
                category: timeCategory,
                baseTimeMs: timeControlMinutes * 60000,
                incrementMs: timeControlIncrementSeconds * 1000
              }
            })
          })

          const retryPayload = await retryResponse.json()
          if (retryPayload.success) {
            setRoomStatus('Joined room with random seat')
            applyOnlineSession(retryPayload.data, 'Joined room')
            return
          }
        }
        setRoomStatus(mapJoinErrorMessage(payload.error || 'Failed to join room'))
        return
      }

      applyOnlineSession(payload.data, 'Joined room')
    } catch (error) {
      setRoomStatus('Failed to join room')
    }
  }

  const applyMove = (source, target) => {
    if (!isBoardSquare(source) || !isBoardSquare(target)) {
      setRoomStatus('Drop inside the board to move')
      playIllegal()
      clearSelection()
      return false
    }

    const probe = new Chess(fen)
    let move = null

    try {
      move = probe.move({ from: source, to: target, promotion: 'q' })
    } catch {
      setRoomStatus('Invalid move')
      playIllegal()
      clearSelection()
      return false
    }

    if (!move) {
      setRoomStatus(`Invalid move from ${source} to ${target}`)
      playIllegal()
      clearSelection()
      return false
    }

    if (onlineMode && roomId && socket) {
      if (spectatorMode) {
        setRoomStatus('You are watching this live game. Create or join to play.')
        clearSelection()
        return false
      }

      if (onlineGameStatus !== 'active' && onlineGameStatus !== 'waiting') {
        setRoomStatus('Wait for opponent to join. Game starts when both players are in.')
        clearSelection()
        return false
      }

      const currentTurn = game.turn() === 'w' ? 'white' : 'black'
      if (currentTurn !== playerColor) {
        setRoomStatus(`Not your turn. ${currentTurn === 'white' ? whiteName : blackName} to move.`)
        clearSelection()
        return false
      }

      socket.emit('move', {
        gameId: roomId,
        playerId: sessionPlayerId,
        from: source,
        to: target,
        promotion: 'q'
      })

      // Optimistic update for responsive drag-drop UX.
      applyPosition({
        fen: probe.fen(),
        moves: probe.history({ verbose: true }),
        lastMove: { from: move.from, to: move.to }
      })
    } else {
      const localSoundEventKey = `local:${move.from}-${move.to}:${probe.fen()}`
      if (lastSoundEventRef.current !== localSoundEventKey) {
        lastSoundEventRef.current = localSoundEventKey
        playMoveByMeta(move, false)
      }
      if (probe.isCheck()) {
        playCheck()
      }
      if (probe.isGameOver()) {
        playGameEnd()
      }
      applyPosition({
        fen: probe.fen(),
        moves: probe.history({ verbose: true }),
        lastMove: { from: move.from, to: move.to }
      })
    }

    lastAppliedMoveRef.current = `${source}-${target}`
    clearSelection()
    if (!onlineMode) {
      setRoomStatus('Move applied')
    }
    return true
  }

  const onPieceDrop = (source, target) => {
    const from = source || dragSourceRef.current
    const didMove = applyMove(from, target)
    dragSourceRef.current = ''
    return didMove
  }

  const onPieceDragBegin = (piece, square) => {
    unlockAudio()
    dragSourceRef.current = square || ''
  }

  const sendChat = () => {
    const value = chatInput.trim()
    if (!value) return
    addChatMessage('You', value)
    setChatInput('')
  }

  return (
    <div
      ref={boardFrameRef}
      className='flex h-full min-h-0 flex-col gap-4 overflow-hidden lg:flex-row'
      onPointerDownCapture={unlockAudio}
      onKeyDownCapture={unlockAudio}
    >
      {/* ── LEFT: Board + Controls ── */}
      <main className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#3a3a38] bg-[#1e1d1a] p-3 shadow-[0_12px_28px_rgba(0,0,0,0.28)]'>
        <section className='flex min-h-0 flex-1 flex-col rounded-xl bg-[#262522] p-3'>
          <div className='mb-2 flex flex-shrink-0 items-center justify-between rounded-lg border border-[#3e3e3b] bg-[#2d2c29] px-3 py-2'>
            <p className='text-xs uppercase tracking-wide text-slate-400'>Live Status</p>
            <span className={`rounded border border-lime-400/35 bg-lime-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lime-200 ${lifecycleMeta.state === 'idle' ? 'border-white/15 bg-white/5 text-slate-300' : ''}`}>
              {lifecycleMeta.title}
            </span>
          </div>

          <div className='grid min-h-0 flex-1 gap-3 lg:grid-cols-[170px_minmax(0,1fr)] xl:grid-cols-[185px_minmax(0,1fr)]'>
            <aside className='order-1 flex min-h-0 flex-col gap-3'>
              <div className='rounded-lg border border-[#42413d] bg-[#34332f] p-3'>
                <p className='text-[11px] uppercase tracking-wide text-slate-400'>Black</p>
                <p className='truncate text-sm font-semibold text-white'>{opponentName || 'Opponent'}</p>
                <p className='mt-2 rounded bg-[#22211f] px-2 py-1 text-2xl font-semibold text-slate-100'>
                  {formatTime(topClockSeconds)}
                </p>
              </div>
              <div className='rounded-lg border border-[#42413d] bg-[#34332f] p-3'>
                <p className='text-[11px] uppercase tracking-wide text-slate-400'>White</p>
                <p className='truncate text-sm font-semibold text-white'>{youName}</p>
                <p className='mt-2 rounded bg-[#ebe9e6] px-2 py-1 text-2xl font-semibold text-[#1f1f1f]'>
                  {formatTime(bottomClockSeconds)}
                </p>
              </div>
            </aside>

            <div ref={boardAreaRef} className='order-2 flex min-h-0 items-center justify-center overflow-hidden'>
            <div
              className='relative rounded-xl bg-[#1f1f1d] p-2 shadow-[0_10px_20px_rgba(0,0,0,0.35)]'
              style={{ width: `${boardWidth + 16}px`, height: `${boardWidth + 16}px`, flexShrink: 0 }}
            >
              {showMatchStartAnimation ? (
                <div className='pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.26),rgba(15,23,42,0.82)_64%)]'>
                  <div className='animate-pulse rounded-2xl border border-emerald-300/60 bg-emerald-300/12 px-6 py-4 text-center shadow-[0_0_32px_rgba(16,185,129,0.32)] backdrop-blur'>
                    <p className='text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-100/90'>Live Match</p>
                    <p className='mt-2 text-2xl font-black uppercase tracking-[0.08em] text-white'>Starting</p>
                  </div>
                </div>
              ) : null}
              {showGameEndAnimation ? (
                <div className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-2xl ${gameEndAnimationTone === 'resign' ? 'bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.24),rgba(15,23,42,0.86)_66%)]' : gameEndAnimationTone === 'draw' ? 'bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.22),rgba(15,23,42,0.86)_66%)]' : 'bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.28),rgba(15,23,42,0.88)_66%)]'}`}>
                  <div className={`rounded-2xl border px-6 py-4 text-center shadow-[0_0_40px_rgba(15,23,42,0.6)] backdrop-blur ${gameEndAnimationTone === 'resign' ? 'border-red-300/60 bg-red-400/12' : gameEndAnimationTone === 'draw' ? 'border-indigo-300/60 bg-indigo-400/12' : 'border-red-300/70 bg-red-500/14'}`}>
                    <p className='text-[11px] font-semibold uppercase tracking-[0.32em] text-white/85'>Game Finished</p>
                    <p className='mt-2 text-3xl font-black uppercase tracking-[0.06em] text-white'>{gameEndAnimationLabel}</p>
                  </div>
                </div>
              ) : null}
              <Chessboard
                id='play-board'
                position={game.fen()}
                boardOrientation={boardOrientation}
                onPieceDrop={onPieceDrop}
                onPieceDragBegin={onPieceDragBegin}
                dropOffBoardAction='snapback'
                arePiecesDraggable={onlineMode ? canMoveOnline : true}
                customSquareStyles={{
                  ...(selectedSquare ? { [selectedSquare]: { background: 'rgba(76, 175, 80, 0.30)', boxShadow: 'inset 0 0 0 2px rgba(76, 175, 80, 0.65)' } } : {}),
                  ...Object.fromEntries(legalMoves.map((sq) => [sq, { background: 'radial-gradient(circle, rgba(76, 175, 80, 0.38) 22%, transparent 24%)' }])),
                  ...(lastMove ? { [lastMove.from]: { background: 'rgba(255, 235, 59, 0.32)' }, [lastMove.to]: { background: 'rgba(255, 235, 59, 0.32)' } } : {})
                }}
                animationDuration={160}
                boardWidth={boardWidth}
                customDarkSquareStyle={{ backgroundColor: boardTheme.dark }}
                customLightSquareStyle={{ backgroundColor: boardTheme.light }}
              />
            </div>
            </div>

          </div>

          {replaySession ? (
            <div className='mt-2 rounded-lg border border-cyan-300/25 bg-cyan-500/10 px-3 py-2'>
              <p className='text-xs font-semibold uppercase tracking-wide text-cyan-200'>Replay Mode (No Analysis)</p>
              <p className='mt-1 text-xs text-slate-200'>
                {replaySession.whitePlayer} vs {replaySession.blackPlayer} • {replaySession.result || 'completed'}
              </p>
              <div className='mt-2 flex flex-wrap gap-2'>
                <button
                  onClick={() => setReplayPly((current) => Math.max(0, current - 1))}
                  disabled={replayPly <= 0}
                  className='rounded border border-white/15 px-2 py-1 text-[11px] text-slate-100 hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:opacity-40'
                >
                  Prev
                </button>
                <button
                  onClick={() => setReplayAutoplay((current) => !current)}
                  disabled={replayPly >= replaySession.moves.length}
                  className='rounded border border-white/15 px-2 py-1 text-[11px] text-slate-100 hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:opacity-40'
                >
                  {replayAutoplay ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={() => setReplayPly((current) => Math.min(replaySession.moves.length, current + 1))}
                  disabled={replayPly >= replaySession.moves.length}
                  className='rounded border border-white/15 px-2 py-1 text-[11px] text-slate-100 hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:opacity-40'
                >
                  Next
                </button>
                <button
                  onClick={stopReplay}
                  className='rounded border border-white/15 px-2 py-1 text-[11px] text-red-200 hover:border-red-300/60 hover:bg-red-500/10'
                >
                  Close Replay
                </button>
                <span className='rounded border border-white/10 px-2 py-1 text-[11px] text-slate-300'>
                  Move {replayPly}/{replaySession.moves.length}
                </span>
              </div>
            </div>
          ) : null}

          <div className='mt-2 rounded-lg border border-[#3e3d39] bg-[#2e2d2a] px-3 py-2 text-xs text-slate-300'>
            Turn: <span className='font-semibold capitalize text-white'>{turn}</span> | {roomStatus}
          </div>
        </section>
      </main>

      <aside className='h-full min-h-0 w-full flex-shrink-0 overflow-y-auto rounded-2xl border border-[#3b3a37] bg-gradient-to-b from-[#23221f] to-[#1b1a18] p-3 backdrop-blur lg:w-[380px] xl:w-[460px]'>
        <div className='mb-3 rounded-lg border border-[#3e3d39] bg-[#2f2e2a] p-2'>
          <p className='mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400'>Actions</p>
          <div className='grid grid-cols-2 gap-2'>
            <button
              onClick={drawCurrentGame}
              disabled={!onlineMode || spectatorMode || onlineGameStatus !== 'active'}
              className='rounded-md border border-[#4a4945] bg-[#252421] px-3 py-2 text-left text-sm whitespace-nowrap text-slate-200 transition hover:border-[#6f6e68] hover:bg-[#2d2c28] disabled:opacity-40'
            >
              {drawOffer.status === 'pending' && drawOffer.byPlayerId !== sessionPlayerId ? 'Accept Draw' : 'Draw'}
            </button>
            <button
              onClick={declineDrawOffer}
              disabled={!onlineMode || spectatorMode || drawOffer.status !== 'pending' || drawOffer.byPlayerId === sessionPlayerId}
              className='rounded-md border border-[#4a4945] bg-[#252421] px-3 py-2 text-left text-sm whitespace-nowrap text-slate-300 transition hover:border-[#6f6e68] hover:bg-[#2d2c28] disabled:opacity-40'
            >
              Decline Draw
            </button>
            <button
              onClick={resignCurrentGame}
              disabled={!onlineMode || spectatorMode || onlineGameStatus !== 'active'}
              className='rounded-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-left text-sm font-medium whitespace-nowrap text-red-200 transition hover:border-red-300/60 hover:bg-red-500/20 disabled:opacity-40'
            >
              Resign
            </button>
            <button
              onClick={requestRematch}
              disabled={!onlineMode || spectatorMode || onlineGameStatus !== 'completed'}
              className='rounded-md border border-[#4a4945] bg-[#252421] px-3 py-2 text-left text-sm whitespace-nowrap text-emerald-300 transition hover:border-emerald-300/60 hover:bg-emerald-500/10 disabled:opacity-40'
            >
              Rematch
            </button>
            <button
              onClick={replayLatestCompletedGame}
              disabled={onlineGameStatus !== 'completed'}
              className='rounded-md border border-[#4a4945] bg-[#252421] px-3 py-2 text-left text-sm whitespace-nowrap text-indigo-300 transition hover:border-indigo-300/60 hover:bg-indigo-500/10 disabled:opacity-40'
            >
              Replay
            </button>
            <button
              onClick={analyzeLatestCompletedGame}
              disabled={onlineGameStatus !== 'completed'}
              className='rounded-md border border-[#4a4945] bg-[#252421] px-3 py-2 text-left text-sm whitespace-nowrap text-violet-300 transition hover:border-violet-300/60 hover:bg-violet-500/10 disabled:opacity-40'
            >
              Analyze
            </button>
            <button
              onClick={resetBoard}
              className='rounded-md border border-[#4a4945] bg-[#252421] px-3 py-2 text-left text-sm font-semibold whitespace-nowrap text-slate-100 transition hover:border-lime-400/60 hover:bg-lime-500/15'
            >
              Reset
            </button>
            {onlineGameStatus === 'completed' ? (
              <button
                onClick={() => openUsernameArchive(youName)}
                className='rounded-md border border-[#4a4945] bg-[#252421] px-3 py-2 text-left text-xs whitespace-nowrap text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10'
              >
                My Games
              </button>
            ) : (
              <button
                disabled
                className='rounded-md border border-[#4a4945] bg-[#252421] px-3 py-2 text-left text-xs whitespace-nowrap text-slate-500 opacity-60'
              >
                Game Archive
              </button>
            )}
          </div>
          {onlineGameStatus === 'completed' ? (
            <button
              onClick={() => openUsernameArchive(opponentName)}
              className='mt-2 w-full rounded-md border border-[#4a4945] bg-[#252421] px-3 py-2 text-left text-xs whitespace-nowrap text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10'
            >
              Opponent Games
            </button>
          ) : null}
        </div>

        <div className='grid grid-cols-3 gap-1 rounded-lg border border-[#32312d] bg-[#171614] p-1'>
          <button
            onClick={() => setPanelTab('new')}
            className={`rounded px-2 py-2 text-sm ${panelTab === 'new' ? 'bg-[#202020] text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            New Game
          </button>
          <button
            onClick={() => setPanelTab('games')}
            className={`rounded px-2 py-2 text-sm ${panelTab === 'games' ? 'bg-[#202020] text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Games
          </button>
          <button
            onClick={() => setPanelTab('players')}
            className={`rounded px-2 py-2 text-sm ${panelTab === 'players' ? 'bg-[#202020] text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Players
          </button>
        </div>

        <div className='mt-3 space-y-3 overflow-auto pr-1'>
          <div className='rounded-lg border border-white/10 bg-[#2a2a2a] p-3'>
            <div className='mb-2 flex items-center justify-between'>
              <p className='text-xs uppercase tracking-wide text-slate-400'>Match Lifecycle</p>
              <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${lifecycleMeta.tone}`}>
                {lifecycleMeta.state}
              </span>
            </div>
            <p className='text-sm font-semibold text-white'>{lifecycleMeta.title}</p>
            <p className='mt-1 text-xs text-slate-400'>{lifecycleMeta.hint}</p>

            <div className='mt-3 grid grid-cols-5 gap-1'>
              {['Idle', 'Seeking', 'Matched', 'In Game', 'Finished'].map((label, index) => {
                const isActive = index === lifecycleMeta.stepIndex
                const isDone = index < lifecycleMeta.stepIndex
                return (
                  <div key={label} className='space-y-1'>
                    <div className={`h-1.5 rounded-full ${isDone ? 'bg-emerald-400/80' : isActive ? 'bg-cyan-300/90' : 'bg-white/10'}`} />
                    <p className={`text-[10px] leading-none ${isActive ? 'text-cyan-200' : 'text-slate-500'}`}>{label}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {panelTab === 'new' && (
            <>
              <div className='rounded-lg border border-white/10 bg-[#2a2a2a] p-3'>
                <p className='mb-2 text-xs uppercase tracking-wide text-slate-400'>Time Control</p>
                <div className='grid grid-cols-3 gap-2 text-sm'>
                  {MATCH_TIME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setTimeControlPreset(preset.id)
                        setTimeControlMinutes(Math.max(1, Math.floor(preset.baseTimeMs / 60000)))
                        setTimeControlIncrementSeconds(Math.max(0, Math.floor(preset.incrementMs / 1000)))
                        setTimeCategory(preset.category)
                      }}
                      className={`rounded px-2 py-2 ${timeControlPreset === preset.id ? 'bg-lime-600/20 text-lime-200 ring-1 ring-lime-400/60' : 'bg-[#1f1f1f] text-slate-200'}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className='rounded-lg border border-white/10 bg-[#2a2a2a] p-3'>
                <p className='mb-2 text-xs uppercase tracking-wide text-slate-400'>Mode</p>
                <div className='grid grid-cols-3 gap-2 text-sm'>
                  {MATCH_MODES.map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setGameMode(mode)}
                      className={`rounded px-2 py-2 capitalize ${gameMode === mode ? 'bg-cyan-600/20 text-cyan-100 ring-1 ring-cyan-400/60' : 'bg-[#1f1f1f] text-slate-200'}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <p className='mt-2 text-[11px] text-slate-400'>Selected: <span className='font-semibold text-slate-200 uppercase'>{gameMode}</span> | {selectedPresetMeta.label} ({selectedPresetMeta.category})</p>
              </div>

              <div className='grid grid-cols-2 gap-2'>
                <button
                  onClick={quickJoinLiveGame}
                  disabled={quickJoinLoading}
                  className='w-full rounded-lg bg-gradient-to-r from-lime-500 to-lime-600 px-4 py-3 text-lg font-semibold text-white transition hover:brightness-110 disabled:opacity-60'
                >
                  {quickJoinLoading ? 'Matching...' : 'Start Game'}
                </button>
                <button
                  onClick={cancelQuickJoinSearch}
                  disabled={!quickJoinLoading}
                  className='w-full rounded-lg border border-white/15 bg-[#2a2a2a] px-4 py-3 text-base font-semibold text-slate-100 transition hover:bg-[#333] disabled:opacity-40'
                >
                  Cancel Search
                </button>
              </div>

              <button
                onClick={createRoom}
                className='w-full rounded-lg bg-[#2a2a2a] px-4 py-3 text-base font-semibold text-slate-100 transition hover:bg-[#333]'
              >
                Custom Challenge
              </button>

              <div className='rounded-lg bg-[#2a2a2a] p-3'>
                <p className='mb-2 text-sm font-semibold text-slate-100'>Play a Friend</p>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder='Your username'
                  className='mb-2 h-10 w-full rounded-lg border border-white/10 bg-[#1f1f1f] px-3 text-sm text-slate-100 placeholder:text-slate-500'
                />
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder='Friend email'
                  className='mb-2 h-10 w-full rounded-lg border border-white/10 bg-[#1f1f1f] px-3 text-sm text-slate-100 placeholder:text-slate-500'
                />
                <button
                  onClick={sendUserInvite}
                  className='w-full rounded-lg bg-[#1f1f1f] px-3 py-2 text-sm text-slate-200 hover:bg-[#282828]'
                >
                  Create Room & Invite
                </button>
                {inviteStatus && <p className='mt-2 text-xs text-slate-400'>{inviteStatus}</p>}
              </div>
            </>
          )}

          {panelTab === 'games' && (
            <>
              <div className='rounded-lg border border-white/10 bg-[#2a2a2a] p-3'>
                <div className='mb-2 flex items-center justify-between'>
                  <p className='text-sm font-semibold text-slate-100'>Open Games</p>
                  <button onClick={fetchWaitingGames} className='text-xs text-cyan-300'>Refresh</button>
                </div>
                <div className='max-h-56 space-y-2 overflow-auto'>
                  {waitingGames.slice(0, 10).map((row) => (
                    <div key={row.gameId} className='rounded bg-[#1f1f1f] p-2'>
                      <p className='text-xs text-slate-200'>
                        <button
                          onClick={() => openUsernameArchive(row.whitePlayer || 'Host')}
                          className='text-cyan-200 hover:text-cyan-100'
                        >
                          {row.whitePlayer || 'Host'}
                        </button>
                        {' '}vs{' '}
                        {row.blackPlayer ? (
                          <button
                            onClick={() => openUsernameArchive(row.blackPlayer)}
                            className='text-cyan-200 hover:text-cyan-100'
                          >
                            {row.blackPlayer}
                          </button>
                        ) : (
                          <span className='text-slate-400'>Waiting</span>
                        )}
                      </p>
                      <p className='text-[11px] text-slate-500'>{row.timers?.mode || `${timeControlMinutes}m`} • {row.status}</p>
                      <div className='mt-1 flex gap-2'>
                        {row.status === 'waiting' ? (
                          <button onClick={() => joinFromLobby(row.gameId)} className='rounded bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-200'>Join</button>
                        ) : (
                          <button onClick={() => watchLiveGame(row.gameId)} className='rounded bg-cyan-500/20 px-2 py-1 text-[11px] text-cyan-200'>Watch</button>
                        )}
                        <button onClick={() => setRoomInput(row.gameId)} className='rounded bg-[#2a2a2a] px-2 py-1 text-[11px] text-slate-300'>Copy ID</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className='rounded-lg border border-white/10 bg-[#2a2a2a] p-3'>
                <p className='mb-2 text-sm font-semibold text-slate-100'>Finished Games</p>
                <div className='max-h-44 space-y-2 overflow-auto'>
                  {completedGames.slice(0, 8).map((row) => (
                    <div key={row.gameId} className='rounded bg-[#1f1f1f] p-2'>
                      <p className='text-xs text-slate-200'>
                        <button onClick={() => openUsernameArchive(row.whitePlayer || 'White')} className='text-cyan-200 hover:text-cyan-100'>
                          {row.whitePlayer || 'White'}
                        </button>
                        {' '}vs{' '}
                        <button onClick={() => openUsernameArchive(row.blackPlayer || 'Black')} className='text-cyan-200 hover:text-cyan-100'>
                          {row.blackPlayer || 'Black'}
                        </button>
                      </p>
                      {Array.isArray(row.analysis?.summary?.notes) && row.analysis.summary.notes[0] ? (
                        <p className='mt-0.5 text-[10px] text-slate-400'>{row.analysis.summary.notes[0]}</p>
                      ) : null}
                      <div className='mt-1 flex items-center justify-between'>
                        <span className='text-[11px] text-slate-500'>{row.result || 'completed'}</span>
                        <div className='flex items-center gap-1'>
                          <button onClick={() => watchCompletedReplay(row, true)} className='rounded bg-indigo-500/20 px-2 py-1 text-[11px] text-indigo-200'>Watch</button>
                          <button onClick={() => analyzeCompletedGame(row)} className='rounded bg-violet-500/20 px-2 py-1 text-[11px] text-violet-200'>Analyze</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {panelTab === 'players' && (
            <>
              <div className='rounded-lg border border-white/10 bg-[#2a2a2a] p-3'>
                <p className='mb-2 text-sm font-semibold text-slate-100'>Join by Room</p>
                <input
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder='Room ID'
                  className='mb-2 h-10 w-full rounded-lg border border-white/10 bg-[#1f1f1f] px-3 text-sm text-slate-100 placeholder:text-slate-500'
                />
                <button onClick={joinRoom} className='w-full rounded-lg bg-[#1f1f1f] px-3 py-2 text-sm text-slate-200 hover:bg-[#282828]'>Join Room</button>
              </div>

              {!!incomingInvites.length && (
                <div className='rounded-lg border border-amber-300/30 bg-amber-500/10 p-3'>
                  <p className='mb-2 text-sm font-semibold text-amber-200'>Incoming Invites</p>
                  <div className='space-y-2'>
                    {incomingInvites.map((invite) => (
                      <div key={invite.inviteId} className='rounded bg-[#1f1f1f] p-2'>
                        <p className='text-xs text-slate-200'>{invite.fromEmail || invite.fromUsername} invited you</p>
                        <div className='mt-1 flex gap-2'>
                          <button onClick={() => acceptInvite(invite)} className='rounded bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-200'>Accept</button>
                          <button onClick={() => setIncomingInvites((current) => current.filter((row) => row.inviteId !== invite.inviteId))} className='rounded bg-[#2a2a2a] px-2 py-1 text-[11px] text-slate-300'>Dismiss</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className='rounded-lg border border-white/10 bg-[#2a2a2a] p-3'>
                <div className='mb-2 flex items-center justify-between'>
                  <p className='text-sm font-semibold text-slate-100'>Games By Player</p>
                  {playerArchiveTarget ? (
                    <span className='text-[11px] text-slate-400'>@{playerArchiveTarget}</span>
                  ) : null}
                </div>
                {playerArchiveLoading ? (
                  <p className='text-xs text-slate-400'>Loading player games...</p>
                ) : (
                  <div className='max-h-48 space-y-2 overflow-auto'>
                    {playerArchiveGames.map((row) => (
                      <div key={`archive-${row.gameId}`} className='rounded bg-[#1f1f1f] p-2'>
                        <p className='text-xs text-slate-200'>
                          <button onClick={() => openUsernameArchive(row.whitePlayer || 'White')} className='text-cyan-200 hover:text-cyan-100'>
                            {row.whitePlayer || 'White'}
                          </button>
                          {' '}vs{' '}
                          <button onClick={() => openUsernameArchive(row.blackPlayer || 'Black')} className='text-cyan-200 hover:text-cyan-100'>
                            {row.blackPlayer || 'Black'}
                          </button>
                        </p>
                        <div className='mt-1 flex items-center justify-between'>
                          <span className='text-[11px] text-slate-500'>{row.result || 'completed'}</span>
                          <div className='flex items-center gap-1'>
                            <button onClick={() => watchCompletedReplay(row, true)} className='rounded bg-cyan-500/20 px-2 py-1 text-[11px] text-cyan-200'>Watch</button>
                            <button onClick={() => analyzeCompletedGame(row)} className='rounded bg-violet-500/20 px-2 py-1 text-[11px] text-violet-200'>Analyze</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!playerArchiveGames.length ? (
                      <p className='text-[11px] text-slate-500'>Click any player username to load their stored games.</p>
                    ) : null}
                  </div>
                )}
              </div>

              <div className='rounded-lg bg-[#1f1f1f] px-3 py-2 text-xs text-slate-400'>
                Socket: {socketStatus} | Room: {roomId || '-'} | You are: <span className='capitalize text-slate-200'>{playerColor}</span>
              </div>
              <div className='rounded-lg bg-[#1f1f1f] px-3 py-2 text-xs text-slate-400'>
                Invite username: <span className='text-slate-200'>{activeUsername || 'not set'}</span>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

export default ChessBoard
