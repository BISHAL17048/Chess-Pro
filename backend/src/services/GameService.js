import { Chess } from 'chess.js'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import User from '../models/User.js'
import GameRecord from '../models/GameRecord.js'
import MatchmakingQueueService from './MatchmakingQueueService.js'
import { evaluateDeterministicDrawState } from '../utils/drawDetection.js'

const TIME_CONTROL_PRESETS = {
  '1+0': { category: 'bullet', baseTimeMs: 60000, incrementMs: 0 },
  '2+1': { category: 'bullet', baseTimeMs: 120000, incrementMs: 1000 },
  '3+0': { category: 'blitz', baseTimeMs: 180000, incrementMs: 0 },
  '3+2': { category: 'blitz', baseTimeMs: 180000, incrementMs: 2000 },
  '5+0': { category: 'blitz', baseTimeMs: 300000, incrementMs: 0 },
  '10+0': { category: 'rapid', baseTimeMs: 600000, incrementMs: 0 },
  '10+5': { category: 'rapid', baseTimeMs: 600000, incrementMs: 5000 },
  '15+10': { category: 'rapid', baseTimeMs: 900000, incrementMs: 10000 },
  '30+0': { category: 'classical', baseTimeMs: 1800000, incrementMs: 0 },
  '30+20': { category: 'classical', baseTimeMs: 1800000, incrementMs: 20000 }
}

const DEFAULT_PRESET = '5+0'

/**
 * GameService - Manages chess game rooms and state
 * Handles game creation, joining, moves, and state management
 */
class GameService {
  constructor() {
    // Map of gameId -> gameState
    this.games = new Map()
    // Map of playerId -> gameId
    this.playerGames = new Map()
    // In-memory archive fallback when MongoDB is unavailable.
    this.archivedGames = new Map()
    this.matchmakingReady = false
    MatchmakingQueueService.init()
      .then(() => {
        this.matchmakingReady = true
      })
      .catch(() => {
        this.matchmakingReady = false
      })

    this.archiveFlushInterval = setInterval(() => {
      Promise.resolve(this.flushArchivedGamesToDb()).catch(() => {})
    }, 15000)
  }

  async flushArchivedGamesToDb() {
    if (!this.isDbReady()) return
    if (!this.archivedGames.size) return

    const entries = Array.from(this.archivedGames.entries())
    for (const [gameId, payload] of entries) {
      try {
        await GameRecord.findOneAndUpdate(
          { gameId: String(gameId) },
          payload,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      } catch {
        // Keep payload in memory and retry on next flush cycle.
      }
    }
  }

  resolveInitialTimeSeconds(options = {}) {
    const control = this.normalizeTimeControl(options)
    return Math.floor(control.baseTimeMs / 1000)
  }

  normalizeRepetitionFen(fen = '') {
    return String(fen || '').trim().split(' ').slice(0, 4).join(' ')
  }

  getHalfmoveClockFromFen(fen = '') {
    const parts = String(fen || '').trim().split(' ')
    const value = Number(parts[4] || 0)
    return Number.isFinite(value) ? value : 0
  }

  materialStateFromFen(fen = '') {
    const board = new Chess(fen).board()
    const state = {
      white: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 },
      black: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 }
    }

    board.forEach((rank) => {
      rank.forEach((piece) => {
        if (!piece) return
        const side = piece.color === 'w' ? state.white : state.black
        if (side[piece.type] != null) {
          side[piece.type] += 1
        }
      })
    })

    return state
  }

  registerFenOccurrence(gameState, fen) {
    const key = this.normalizeRepetitionFen(fen)
    if (!key) return

    const current = Number(gameState.repetitionCount?.[key] || 0)
    gameState.repetitionCount = {
      ...(gameState.repetitionCount || {}),
      [key]: current + 1
    }

    const history = Array.isArray(gameState.fenHistory) ? gameState.fenHistory : []
    gameState.fenHistory = [...history, fen]
  }

  resolveDrawResultToken(drawType) {
    const token = String(drawType || '').toLowerCase()
    if (token === 'stalemate') return 'stalemate'
    return 'draw'
  }

  evaluateDrawState(gameState, metadataOverrides = {}, runtime = {}) {
    const currentFen = gameState?.board?.fen || new Chess().fen()
    const game = runtime.game || new Chess(currentFen)
    const metadata = {
      halfmove_clock: this.getHalfmoveClockFromFen(currentFen),
      repetition_count: gameState?.repetitionCount || {},
      timeout_flag: false,
      timeout_loser: null,
      draw_agreed: false,
      player_to_move: game.turn() === 'w' ? 'white' : 'black',
      material_state: this.materialStateFromFen(currentFen),
      ...metadataOverrides
    }

    return evaluateDeterministicDrawState({
      moves: gameState?.moveHistory || [],
      fenHistory: gameState?.fenHistory || [],
      metadata,
      isStalemate: game.isStalemate(),
      isKingInCheck: game.isCheck()
    })
  }

  normalizeTimeControl(options = {}) {
    const raw = options.timeControl || {}
    const preset = String(raw.preset || options.timeControlPreset || DEFAULT_PRESET)
    const knownPreset = TIME_CONTROL_PRESETS[preset]
    if (knownPreset) {
      return {
        preset,
        category: knownPreset.category,
        baseTimeMs: knownPreset.baseTimeMs,
        incrementMs: knownPreset.incrementMs,
        label: preset
      }
    }

    const baseTimeMs = Number(raw.baseTimeMs || (Number(options.timeControlMinutes || 5) * 60000))
    const incrementMs = Number(raw.incrementMs || 0)
    const safeBase = Number.isFinite(baseTimeMs) ? Math.max(60000, Math.min(7200000, Math.floor(baseTimeMs))) : 300000
    const safeInc = Number.isFinite(incrementMs) ? Math.max(0, Math.min(60000, Math.floor(incrementMs))) : 0
    const category = String(raw.category || options.timeCategory || this.classifyTimeControl(safeBase, safeInc))
    const label = `${Math.floor(safeBase / 60000)}+${Math.floor(safeInc / 1000)}`

    return {
      preset: label,
      category,
      baseTimeMs: safeBase,
      incrementMs: safeInc,
      label
    }
  }

  classifyTimeControl(baseTimeMs, incrementMs) {
    const estimatedGameSeconds = Math.floor(baseTimeMs / 1000) + Math.floor((incrementMs / 1000) * 40)
    if (estimatedGameSeconds <= 179) return 'bullet'
    if (estimatedGameSeconds <= 479) return 'blitz'
    if (estimatedGameSeconds <= 1499) return 'rapid'
    return 'classical'
  }

  normalizeMatchMode(mode) {
    const safe = String(mode || '').toLowerCase()
    if (safe === 'rated') return 'rated'
    if (safe === 'friend') return 'friend'
    if (safe === 'bot') return 'bot'
    if (safe === 'tournament') return 'tournament'
    return 'casual'
  }

  normalizeColorPreference(value) {
    const safe = String(value || '').toLowerCase()
    if (safe === 'white') return 'white'
    if (safe === 'black') return 'black'
    return 'random'
  }

  resolveHostColor(preference) {
    const normalized = this.normalizeColorPreference(preference)
    if (normalized === 'white' || normalized === 'black') {
      return normalized
    }

    return Math.random() < 0.5 ? 'white' : 'black'
  }

  getOpenSeatColor(gameState) {
    if (!gameState?.players?.white?.id) return 'white'
    if (!gameState?.players?.black?.id) return 'black'
    return null
  }

  isColorCompatible(preference, seatColor) {
    const normalized = this.normalizeColorPreference(preference)
    if (normalized === 'random') return true
    return normalized === seatColor
  }

  getRatingCategoryForGame(gameState) {
    const category = String(gameState?.timeControl?.category || 'blitz').toLowerCase()
    if (category === 'bullet' || category === 'blitz' || category === 'rapid') {
      return category
    }
    if (category === 'classical') {
      return 'rapid'
    }
    return 'blitz'
  }

  expectedScore(ratingA, ratingB) {
    return 1 / (1 + (10 ** ((ratingB - ratingA) / 400)))
  }

  resolveKFactor(playerRating, totalGamesPlayed) {
    const safeGames = Number.isFinite(Number(totalGamesPlayed)) ? Number(totalGamesPlayed) : 0
    const safeRating = Number.isFinite(Number(playerRating)) ? Number(playerRating) : 100

    if (safeGames < 30) return 40
    if (safeRating < 2000) return 20
    return 10
  }

  resolveResultScore(result) {
    if (result === 'white-win' || result === 'black-timeout') {
      return { white: 1, black: 0, apply: true }
    }
    if (result === 'black-win' || result === 'white-timeout') {
      return { white: 0, black: 1, apply: true }
    }
    if (result === 'draw' || result === 'stalemate') {
      return { white: 0.5, black: 0.5, apply: true }
    }
    return { white: 0.5, black: 0.5, apply: false }
  }

  async applyRatingsAndStats(gameState) {
    if (gameState.ratingApplied === true) return
    if (!gameState.players?.white?.id || !gameState.players?.black?.id) return

    const score = this.resolveResultScore(gameState.result)
    if (!score.apply) return

    gameState.ratingApplied = true

    const category = this.getRatingCategoryForGame(gameState)
    const whiteId = String(gameState.players.white.id)
    const blackId = String(gameState.players.black.id)

    const [whiteUser, blackUser] = await Promise.all([
      User.findById(whiteId),
      User.findById(blackId)
    ])

    if (!whiteUser || !blackUser) return

    const whiteRating = Number(whiteUser?.ratings?.[category] || 100)
    const blackRating = Number(blackUser?.ratings?.[category] || 100)
    const whiteGamesPlayedTotal = Number(whiteUser?.gamesPlayed?.total || 0)
    const blackGamesPlayedTotal = Number(blackUser?.gamesPlayed?.total || 0)

    const expectedWhite = this.expectedScore(whiteRating, blackRating)
    const expectedBlack = this.expectedScore(blackRating, whiteRating)
    const whiteK = this.resolveKFactor(whiteRating, whiteGamesPlayedTotal)
    const blackK = this.resolveKFactor(blackRating, blackGamesPlayedTotal)

    const whiteChange = Math.round(whiteK * (score.white - expectedWhite))
    const blackChange = Math.round(blackK * (score.black - expectedBlack))

    const nextWhite = Math.max(100, whiteRating + whiteChange)
    const nextBlack = Math.max(100, blackRating + blackChange)

    whiteUser.ratings = {
      ...whiteUser.ratings,
      [category]: nextWhite
    }
    blackUser.ratings = {
      ...blackUser.ratings,
      [category]: nextBlack
    }

    const isRatedGame = String(gameState?.gameMode || '').toLowerCase() === 'rated' || Boolean(gameState?.rated)

    whiteUser.gamesPlayed = {
      total: whiteGamesPlayedTotal + 1,
      rated: Number(whiteUser?.gamesPlayed?.rated || 0) + (isRatedGame ? 1 : 0),
      casual: Number(whiteUser?.gamesPlayed?.casual || 0) + (isRatedGame ? 0 : 1)
    }

    blackUser.gamesPlayed = {
      total: blackGamesPlayedTotal + 1,
      rated: Number(blackUser?.gamesPlayed?.rated || 0) + (isRatedGame ? 1 : 0),
      casual: Number(blackUser?.gamesPlayed?.casual || 0) + (isRatedGame ? 0 : 1)
    }

    await Promise.all([whiteUser.save(), blackUser.save()])
  }

  scheduleGameFinalization(gameState) {
    if (gameState.status !== 'completed') return
    if (gameState.postGameQueued === true) return

    gameState.postGameQueued = true
    Promise.resolve()
      .then(async () => {
        await this.persistCompletedGame(gameState)
        if (gameState.ratingApplied !== true) {
          await this.applyRatingsAndStats(gameState)
        }
      })
      .catch(() => {})
      .finally(() => {
        gameState.postGameQueued = false
      })
  }

  isDbReady() {
    return mongoose.connection.readyState === 1
  }

  materialBalance(game) {
    const values = {
      p: 1,
      n: 3,
      b: 3,
      r: 5,
      q: 9,
      k: 0
    }

    const board = game.board()
    let score = 0
    for (const row of board) {
      for (const piece of row) {
        if (!piece) continue
        const value = values[piece.type] || 0
        score += piece.color === 'w' ? value : -value
      }
    }

    return score
  }

  resolveGameOutcomeSummary(result) {
    if (result === 'white-win' || result === 'black-timeout') return { winner: 'white', reason: 'checkmate-or-win' }
    if (result === 'black-win' || result === 'white-timeout') return { winner: 'black', reason: 'checkmate-or-win' }
    if (result === 'draw' || result === 'stalemate') return { winner: 'none', reason: result }
    if (result === 'aborted-no-first-move') return { winner: 'none', reason: 'aborted' }
    return { winner: 'none', reason: result || 'completed' }
  }

  buildGameAnalysis(gameState) {
    const replay = new Chess(gameState.initialFen || new Chess().fen())
    const timeline = []
    let maxSwing = 0

    for (let index = 0; index < (gameState.moveHistory || []).length; index += 1) {
      const row = gameState.moveHistory[index] || {}
      const fenBefore = replay.fen()
      const materialBefore = this.materialBalance(replay)

      let played = null
      try {
        played = replay.move({
          from: row.from,
          to: row.to,
          promotion: row.promotion || 'q'
        })
      } catch {
        played = null
      }

      if (!played) {
        continue
      }

      const fenAfter = replay.fen()
      const materialAfter = this.materialBalance(replay)
      const materialDelta = materialAfter - materialBefore
      if (Math.abs(materialDelta) > maxSwing) {
        maxSwing = Math.abs(materialDelta)
      }

      const tags = []
      if (played.captured) tags.push('capture')
      if (played.promotion) tags.push('promotion')
      if (played.san === 'O-O' || played.san === 'O-O-O') tags.push('castle')
      if (replay.isCheckmate()) tags.push('checkmate')
      else if (replay.isCheck()) tags.push('check')

      timeline.push({
        ply: index + 1,
        san: played.san,
        byColor: played.color === 'w' ? 'white' : 'black',
        fenBefore,
        fenAfter,
        materialBefore,
        materialAfter,
        materialDelta,
        advantageCp: Math.round(materialAfter * 100),
        tags
      })
    }

    const totalPlies = timeline.length
    const openingPhasePlies = Math.min(totalPlies, 20)
    const middlegamePhasePlies = Math.max(0, Math.min(totalPlies - openingPhasePlies, 40))
    const endgamePhasePlies = Math.max(0, totalPlies - openingPhasePlies - middlegamePhasePlies)
    const outcome = this.resolveGameOutcomeSummary(gameState.result)

    const notableSwings = timeline
      .filter((entry) => Math.abs(entry.materialDelta) >= 1)
      .slice(0, 4)
      .map((entry) => `Ply ${entry.ply}: ${entry.san} (${entry.materialDelta > 0 ? '+' : ''}${entry.materialDelta})`)

    const notes = [
      `Game finished with ${totalPlies} plies and result ${gameState.result || 'completed'}.`,
      `Winner: ${outcome.winner}.`,
      notableSwings.length ? `Key swings: ${notableSwings.join(' | ')}` : 'No major material swings detected.'
    ]

    return {
      summary: {
        winner: outcome.winner,
        openingPhasePlies,
        middlegamePhasePlies,
        endgamePhasePlies,
        maxMaterialSwing: maxSwing,
        finalMaterialBalance: timeline.length ? timeline[timeline.length - 1].materialAfter : 0,
        notes
      },
      timeline
    }
  }

  toArchivedMoveList(moveHistory = []) {
    return moveHistory.map((move, index) => ({
      ply: index + 1,
      san: move.san || move.move || '',
      from: move.from,
      to: move.to,
      color: move.playerColor || (move.color === 'w' ? 'white' : 'black'),
      piece: move.piece || null,
      captured: move.captured || null,
      promotion: move.promotion || null,
      fen: move.fen || '',
      timestamp: move.timestamp ? new Date(move.timestamp) : null
    }))
  }

  async persistCompletedGame(gameState) {
    if (!gameState || gameState.status !== 'completed') return null
    if (gameState.archiveSaved === true) return gameState.archiveRecord || null

    const whiteId = String(gameState.players?.white?.id || '')
    const blackId = String(gameState.players?.black?.id || '')
    if (!whiteId || !blackId) return null

    const archivedPayload = {
      gameId: String(gameState.gameId),
      status: gameState.status,
      result: gameState.result || null,
      reason: gameState.endReason || null,
      gameMode: gameState.gameMode || 'casual',
      rated: Boolean(gameState.rated),
      variant: gameState.variant || 'standard',
      timeControl: this.normalizeTimeControl(gameState),
      whitePlayer: {
        userId: whiteId,
        username: gameState.players.white.username || 'White',
        email: gameState.players.white.email || null
      },
      blackPlayer: {
        userId: blackId,
        username: gameState.players.black.username || 'Black',
        email: gameState.players.black.email || null
      },
      initialFen: gameState.initialFen || new Chess().fen(),
      finalFen: gameState.board?.fen || new Chess().fen(),
      pgn: gameState.board?.pgn || '',
      moveCount: Number(gameState.board?.moveCount || 0),
      moves: this.toArchivedMoveList(gameState.moveHistory),
      analysis: this.buildGameAnalysis(gameState),
      drawDetection: gameState.drawDetection || { is_draw: false, type: null, automatic: false },
      createdAtGame: gameState.createdAt || null,
      startedAtGame: gameState.startedAt || null,
      endedAtGame: gameState.endedAt || null
    }

    this.archivedGames.set(archivedPayload.gameId, archivedPayload)

    if (this.isDbReady()) {
      try {
        const stored = await GameRecord.findOneAndUpdate(
          { gameId: archivedPayload.gameId },
          archivedPayload,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )

        this.archivedGames.delete(archivedPayload.gameId)

        gameState.archiveSaved = true
        gameState.archiveRecord = stored
        return stored
      } catch {
        gameState.archiveSaved = true
        gameState.archiveRecord = archivedPayload
        return archivedPayload
      }
    }

    gameState.archiveSaved = true
    gameState.archiveRecord = archivedPayload
    return archivedPayload
  }

  buildTimerSnapshot(gameState) {
    if (!gameState?.timers) return null

    return {
      mode: gameState.timers.mode,
      white: gameState.timers.whiteRemaining,
      black: gameState.timers.blackRemaining,
      incrementSeconds: gameState.timers.incrementSeconds || 0,
      activeColor: gameState.timers.activeColor
    }
  }

  ensureFirstMoveWindow(gameState) {
    if (!gameState || gameState.status !== 'active') return false

    // Backward-compatible fallback: any active game with no moves should be in first-move grace.
    const inferredPending = (gameState.board?.moveCount || 0) === 0
    const pending = gameState.firstMovePending === true || inferredPending

    if (!pending) return false

    if (!gameState.firstMoveDeadlineAt) {
      const base = gameState.startedAt ? new Date(gameState.startedAt).getTime() : Date.now()
      gameState.firstMoveDeadlineAt = base + 30000
    }

    if (gameState.firstMovePending !== true) {
      gameState.firstMovePending = true
    }

    return true
  }

  updateClock(gameState) {
    if (!gameState?.timers) return
    if (gameState.status !== 'active') return

    if (this.ensureFirstMoveWindow(gameState)) {
      const now = Date.now()
      if (gameState.firstMoveDeadlineAt && now >= gameState.firstMoveDeadlineAt) {
        gameState.status = 'completed'
        gameState.result = 'aborted-no-first-move'
        gameState.endReason = 'no-first-move-timeout'
        gameState.endedAt = new Date()
        gameState.timers.lastTickAt = null
        this.scheduleGameFinalization(gameState)
      }
      return
    }

    const now = Date.now()
    if (!gameState.timers.lastTickAt) {
      gameState.timers.lastTickAt = now
      return
    }

    const elapsed = Math.floor((now - gameState.timers.lastTickAt) / 1000)
    if (elapsed <= 0) return

    const activeColor = gameState.timers.activeColor
    if (activeColor === 'white') {
      gameState.timers.whiteRemaining = Math.max(0, gameState.timers.whiteRemaining - elapsed)
    } else {
      gameState.timers.blackRemaining = Math.max(0, gameState.timers.blackRemaining - elapsed)
    }

    gameState.timers.lastTickAt = now

    if (gameState.timers.whiteRemaining === 0 || gameState.timers.blackRemaining === 0) {
      const timeoutLoser = gameState.timers.whiteRemaining === 0 ? 'white' : 'black'
      const drawState = this.evaluateDrawState(gameState, {
        timeout_flag: true,
        timeout_loser: timeoutLoser
      })

      if (drawState.is_draw) {
        gameState.status = 'completed'
        gameState.result = this.resolveDrawResultToken(drawState.type)
        gameState.endReason = String(drawState.type || 'draw').toLowerCase().replace(/\s+/g, '-')
        gameState.drawDetection = drawState
      } else {
        gameState.status = 'completed'
        gameState.result = timeoutLoser === 'white' ? 'white-timeout' : 'black-timeout'
        gameState.endReason = 'timeout'
        gameState.drawDetection = {
          is_draw: false,
          type: null,
          automatic: false
        }
      }

      gameState.endedAt = new Date()
      gameState.timers.lastTickAt = null
      this.scheduleGameFinalization(gameState)
    }
  }

  /**
   * Create a new game room
   * @param {string} playerId - ID of the player creating the game
   * @param {Object} options - Game options (time controls, etc.)
   * @returns {Object} Game state with room info
   */
  createGame(playerId, options = {}) {
    const gameId = uuidv4()
    const game = new Chess()
    const timeControl = this.normalizeTimeControl(options)
    const initialSeconds = Math.floor(timeControl.baseTimeMs / 1000)
    const incrementSeconds = Math.floor(timeControl.incrementMs / 1000)
    const gameMode = this.normalizeMatchMode(options.gameMode)
    const playerRating = Number(options.rating || 100)
    const colorPreference = this.normalizeColorPreference(options.colorPreference)
    const hostColor = this.resolveHostColor(colorPreference)

    const whitePlayer = hostColor === 'white'
      ? {
          id: playerId,
          socketId: null,
          username: options.username || `Player_${playerId.slice(0, 8)}`,
          email: String(options.email || '').trim().toLowerCase() || null,
          ratingSnapshot: playerRating
        }
      : {
          id: null,
          socketId: null,
          username: null,
          email: null,
          ratingSnapshot: null
        }

    const blackPlayer = hostColor === 'black'
      ? {
          id: playerId,
          socketId: null,
          username: options.username || `Player_${playerId.slice(0, 8)}`,
          email: String(options.email || '').trim().toLowerCase() || null,
          ratingSnapshot: playerRating
        }
      : {
          id: null,
          socketId: null,
          username: null,
          email: null,
          ratingSnapshot: null
        }

    const gameState = {
      gameId,
      status: 'waiting', // waiting, active, completed
      createdAt: new Date(),
      updatedAt: new Date(),
      queueJoinedAt: Date.now(),
      initialFen: game.fen(),
      gameMode,
      rated: gameMode === 'rated',
      variant: String(options.variant || 'standard'),
      colorPreference,
      timeControl,
      players: {
        white: whitePlayer,
        black: blackPlayer
      },
      currentTurn: 'white',
      board: {
        fen: game.fen(),
        pgn: game.pgn(),
        moves: [],
        moveCount: 0
      },
      moveHistory: [],
      fenHistory: [game.fen()],
      repetitionCount: {
        [this.normalizeRepetitionFen(game.fen())]: 1
      },
      timers: {
        mode: timeControl.label,
        whiteRemaining: initialSeconds,
        blackRemaining: initialSeconds,
        incrementSeconds,
        activeColor: 'white',
        lastTickAt: null
      },
      drawOffer: {
        status: 'none', // none | pending
        byPlayerId: null,
        byColor: null,
        createdAt: null
      },
      rematchOffer: {
        status: 'none', // none | pending
        byPlayerId: null,
        byColor: null,
        createdAt: null,
        rematchGameId: null
      },
      drawDetection: {
        is_draw: false,
        type: null,
        automatic: false
      },
      result: null, // null, 'white-win', 'black-win', 'draw', 'stalemate'
      startedAt: null,
      endedAt: null,
      ...options
    }

    this.games.set(gameId, gameState)
    this.playerGames.set(playerId, gameId)

    return {
      gameId,
      status: gameState.status,
      playerId: playerId,
      playerColor: hostColor,
      board: gameState.board,
      timers: this.buildTimerSnapshot(gameState),
      players: gameState.players,
      colorPreference,
      openSeatColor: this.getOpenSeatColor(gameState)
    }
  }

  /**
   * Join an existing game room
   * @param {string} gameId - Game room ID to join
   * @param {string} playerId - Player ID joining the game
   * @param {string} username - Player username
   * @returns {Object} Game state or error
   */
  joinGame(gameId, playerId, username = null, rating = 100, colorPreference = 'random', email = null) {
    const gameState = this.games.get(gameId)

    if (!gameState) {
      return {
        success: false,
        error: 'Game room not found'
      }
    }

    if (gameState.status === 'active' || gameState.status === 'completed') {
      return {
        success: false,
        error: 'Game is already in progress or completed'
      }
    }

    const openSeatColor = this.getOpenSeatColor(gameState)
    if (!openSeatColor) {
      return {
        success: false,
        error: 'Game room is full'
      }
    }

    if (gameState.players.white.id === playerId || gameState.players.black.id === playerId) {
      return {
        success: false,
        error: 'You cannot join your own match'
      }
    }

    if (!this.isColorCompatible(colorPreference, openSeatColor)) {
      return {
        success: false,
        error: `Requested color unavailable. Open seat is ${openSeatColor}.`
      }
    }

    gameState.players[openSeatColor].id = playerId
    gameState.players[openSeatColor].username = username || `Player_${playerId.slice(0, 8)}`
    gameState.players[openSeatColor].email = String(email || '').trim().toLowerCase() || null
    gameState.players[openSeatColor].ratingSnapshot = Number(rating || 100)
    gameState.status = 'active'
    gameState.startedAt = new Date()
    gameState.updatedAt = new Date()
    gameState.timers.activeColor = 'white'
    gameState.timers.lastTickAt = null
    gameState.firstMovePending = true
    gameState.firstMoveDeadlineAt = Date.now() + 30000
    gameState.drawDetection = {
      is_draw: false,
      type: null,
      automatic: false
    }

    this.playerGames.set(playerId, gameId)

    const queuePayload = {
      mode: gameState.gameMode,
      preset: gameState.timeControl?.preset,
      variant: gameState.variant,
      gameId
    }
    Promise.resolve(MatchmakingQueueService.removeByGameId(queuePayload)).catch(() => {})

    return {
      success: true,
      gameId,
      status: gameState.status,
      playerId,
      playerColor: openSeatColor,
      board: gameState.board,
      timers: this.buildTimerSnapshot(gameState),
      players: gameState.players
    }
  }

  /**
   * Get game state
   * @param {string} gameId - Game room ID
   * @returns {Object} Current game state
   */
  getGameState(gameId) {
    const gameState = this.games.get(gameId)

    if (!gameState) {
      return null
    }

    this.updateClock(gameState)

    const preMoveSecondsLeft = gameState.firstMovePending && gameState.firstMoveDeadlineAt
      ? Math.max(0, Math.ceil((gameState.firstMoveDeadlineAt - Date.now()) / 1000))
      : null

    return {
      gameId: gameState.gameId,
      status: gameState.status,
      fen: gameState.board.fen,
      pgn: gameState.board.pgn,
      moves: gameState.moveHistory,
      currentTurn: gameState.currentTurn,
      players: gameState.players,
      timers: this.buildTimerSnapshot(gameState),
      moveCount: gameState.board.moveCount,
      result: gameState.result,
      reason: gameState.endReason || null,
      drawDetection: gameState.drawDetection || { is_draw: false, type: null, automatic: false },
      firstMovePending: Boolean(gameState.firstMovePending),
      firstMoveSecondsLeft: preMoveSecondsLeft,
      drawOffer: gameState.drawOffer,
      rematchOffer: gameState.rematchOffer,
      createdAt: gameState.createdAt,
      startedAt: gameState.startedAt,
      endedAt: gameState.endedAt
    }
  }

  /**
   * Get board state for a game
   * @param {string} gameId - Game room ID
   * @returns {Object} Board state
   */
  getBoardState(gameId) {
    const gameState = this.games.get(gameId)

    if (!gameState) {
      return null
    }

    this.updateClock(gameState)

    const preMoveSecondsLeft = gameState.firstMovePending && gameState.firstMoveDeadlineAt
      ? Math.max(0, Math.ceil((gameState.firstMoveDeadlineAt - Date.now()) / 1000))
      : null

    return {
      fen: gameState.board.fen,
      pgn: gameState.board.pgn,
      moves: gameState.moveHistory,
      moveCount: gameState.board.moveCount,
      timers: this.buildTimerSnapshot(gameState),
      status: gameState.status,
      result: gameState.result,
      reason: gameState.endReason || null,
      drawDetection: gameState.drawDetection || { is_draw: false, type: null, automatic: false },
      currentTurn: gameState.currentTurn,
      firstMovePending: Boolean(gameState.firstMovePending),
      firstMoveSecondsLeft: preMoveSecondsLeft,
      drawOffer: gameState.drawOffer,
      rematchOffer: gameState.rematchOffer,
      check: this.isCheck(gameId),
      checkmate: this.isCheckmate(gameId),
      stalemate: this.isStalemate(gameId),
      draw: this.isDraw(gameId)
    }
  }

  /**
   * Make a move in a game
   * @param {string} gameId - Game room ID
   * @param {string} playerId - Player making the move
   * @param {Object} moveData - Move data {from, to, promotion}
   * @returns {Object} Move result
   */
  makeMove(gameId, playerId, moveData) {
    const gameState = this.games.get(gameId)

    if (!gameState) {
      return {
        success: false,
        error: 'Game not found'
      }
    }

    if (gameState.status !== 'active') {
      return {
        success: false,
        error: 'Game is not active'
      }
    }

    this.updateClock(gameState)
    if (gameState.status === 'completed') {
      return {
        success: false,
        error: 'Game ended on time',
        status: gameState.status,
        result: gameState.result,
        timers: this.buildTimerSnapshot(gameState)
      }
    }

    // Verify it's the player's turn
    const playerColor = this.getPlayerColor(gameId, playerId)
    if (!playerColor) {
      return {
        success: false,
        error: 'Player not in this game'
      }
    }

    if (gameState.currentTurn !== playerColor) {
      return {
        success: false,
        error: 'Not your turn'
      }
    }

    // Create Chess instance from current FEN to make the move
    const game = new Chess(gameState.board.fen)

    try {
      // Attempt the move
      const move = game.move({
        from: moveData.from,
        to: moveData.to,
        promotion: moveData.promotion || 'q'
      })

      if (!move) {
        return {
          success: false,
          error: 'Invalid move'
        }
      }

      // Update game state
      gameState.board.fen = game.fen()
      gameState.board.pgn = game.pgn()
      gameState.board.moves.push(move)
      gameState.board.moveCount++
      gameState.currentTurn = game.turn() === 'w' ? 'white' : 'black'
      const wasFirstMove = gameState.firstMovePending === true
      if (wasFirstMove) {
        gameState.firstMovePending = false
        gameState.firstMoveDeadlineAt = null
      }

      if (playerColor === 'white') {
        gameState.timers.whiteRemaining += gameState.timers.incrementSeconds || 0
      } else {
        gameState.timers.blackRemaining += gameState.timers.incrementSeconds || 0
      }

      gameState.timers.activeColor = gameState.currentTurn
      gameState.timers.lastTickAt = Date.now()
      gameState.updatedAt = new Date()
      if (gameState.drawOffer.status === 'pending') {
        gameState.drawOffer = {
          status: 'none',
          byPlayerId: null,
          byColor: null,
          createdAt: null
        }
      }

      // Record move in history
      gameState.moveHistory.push({
        move: move.san,
        san: move.san,
        color: move.color,
        piece: move.piece,
        captured: move.captured || null,
        from: move.from,
        to: move.to,
        playerId,
        playerColor,
        timestamp: new Date(),
        fen: game.fen()
      })

      this.registerFenOccurrence(gameState, game.fen())

      // Check game end conditions
      if (game.isCheckmate()) {
        gameState.status = 'completed'
        gameState.result = playerColor === 'white' ? 'white-win' : 'black-win'
        gameState.endReason = 'checkmate'
        gameState.drawDetection = {
          is_draw: false,
          type: null,
          automatic: false
        }
        gameState.endedAt = new Date()
        gameState.timers.lastTickAt = null
        this.scheduleGameFinalization(gameState)
      } else {
        const drawState = this.evaluateDrawState(gameState, {
          timeout_flag: false,
          timeout_loser: null
        }, { game })

        if (drawState.is_draw) {
          gameState.drawDetection = drawState

          if (drawState.automatic) {
            gameState.status = 'completed'
            gameState.result = this.resolveDrawResultToken(drawState.type)
            gameState.endReason = String(drawState.type || 'draw').toLowerCase().replace(/\s+/g, '-')
            gameState.endedAt = new Date()
            gameState.timers.lastTickAt = null
            this.scheduleGameFinalization(gameState)
          }
        } else {
          gameState.drawDetection = {
            is_draw: false,
            type: null,
            automatic: false
          }
        }
      }

      return {
        success: true,
        move: move.san,
        fen: gameState.board.fen,
        pgn: gameState.board.pgn,
        currentTurn: gameState.currentTurn,
        timers: this.buildTimerSnapshot(gameState),
        status: gameState.status,
        result: gameState.result,
        reason: gameState.endReason || null,
        drawDetection: gameState.drawDetection || { is_draw: false, type: null, automatic: false },
        moveHistory: gameState.moveHistory
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get legal moves for a square
   * @param {string} gameId - Game room ID
   * @param {string} square - Square to get moves for
   * @returns {string[]} Array of legal destination squares
   */
  getLegalMoves(gameId, square) {
    const gameState = this.games.get(gameId)

    if (!gameState) {
      return []
    }

    const game = new Chess(gameState.board.fen)
    const moves = game.moves({ square, verbose: true })
    return moves.map(m => m.to)
  }

  /**
   * Get all legal moves in current position
   * @param {string} gameId - Game room ID
   * @returns {string[]} Array of legal moves
   */
  getAllLegalMoves(gameId) {
    const gameState = this.games.get(gameId)

    if (!gameState) {
      return []
    }

    const game = new Chess(gameState.board.fen)
    return game.moves()
  }

  /**
   * Check if current position is check
   * @param {string} gameId - Game room ID
   * @returns {boolean}
   */
  isCheck(gameId) {
    const gameState = this.games.get(gameId)
    if (!gameState) return false

    const game = new Chess(gameState.board.fen)
    return game.isCheck()
  }

  /**
   * Check if current position is checkmate
   * @param {string} gameId - Game room ID
   * @returns {boolean}
   */
  isCheckmate(gameId) {
    const gameState = this.games.get(gameId)
    if (!gameState) return false

    const game = new Chess(gameState.board.fen)
    return game.isCheckmate()
  }

  /**
   * Check if current position is stalemate
   * @param {string} gameId - Game room ID
   * @returns {boolean}
   */
  isStalemate(gameId) {
    const gameState = this.games.get(gameId)
    if (!gameState) return false

    const game = new Chess(gameState.board.fen)
    return game.isStalemate()
  }

  /**
   * Check if current position is draw
   * @param {string} gameId - Game room ID
   * @returns {boolean}
   */
  isDraw(gameId) {
    const gameState = this.games.get(gameId)
    if (!gameState) return false

    const game = new Chess(gameState.board.fen)
    return game.isDraw()
  }

  /**
   * Get player color in a game
   * @param {string} gameId - Game room ID
   * @param {string} playerId - Player ID
   * @returns {string} 'white', 'black', or null
   */
  getPlayerColor(gameId, playerId) {
    const gameState = this.games.get(gameId)

    if (!gameState) return null

    if (gameState.players.white.id === playerId) return 'white'
    if (gameState.players.black.id === playerId) return 'black'
    return null
  }

  /**
   * Resign from a game
   * @param {string} gameId - Game room ID
   * @param {string} playerId - Player resigning
   * @returns {Object} Result
   */
  resignGame(gameId, playerId) {
    const gameState = this.games.get(gameId)

    if (!gameState) {
      return { success: false, error: 'Game not found' }
    }

    if (gameState.status !== 'active') {
      return { success: false, error: 'Game is not active' }
    }

    const playerColor = this.getPlayerColor(gameId, playerId)
    if (!playerColor) {
      return { success: false, error: 'Player not in this game' }
    }

    gameState.status = 'completed'
    gameState.result = playerColor === 'white' ? 'black-win' : 'white-win'
    gameState.endReason = 'resignation'
    gameState.drawDetection = {
      is_draw: false,
      type: null,
      automatic: false
    }
    gameState.endedAt = new Date()
    gameState.timers.lastTickAt = null
    this.scheduleGameFinalization(gameState)

    return {
      success: true,
      result: gameState.result,
      winner: playerColor === 'white' ? 'black' : 'white'
    }
  }

  /**
   * Accept draw and finish game.
   * @param {string} gameId
   * @param {string} playerId
   * @returns {Object}
   */
  drawGame(gameId, playerId) {
    const gameState = this.games.get(gameId)

    if (!gameState) {
      return { success: false, error: 'Game not found' }
    }

    if (gameState.status !== 'active') {
      return { success: false, error: 'Game is not active' }
    }

    const playerColor = this.getPlayerColor(gameId, playerId)
    if (!playerColor) {
      return { success: false, error: 'Player not in this game' }
    }

    gameState.status = 'completed'
    gameState.result = 'draw'
    gameState.endReason = 'draw-agreed'
    gameState.drawDetection = {
      is_draw: true,
      type: 'Agreement',
      automatic: false
    }
    gameState.endedAt = new Date()
    gameState.timers.lastTickAt = null
    this.scheduleGameFinalization(gameState)

    return {
      success: true,
      result: 'draw'
    }
  }

  offerDraw(gameId, playerId) {
    const gameState = this.games.get(gameId)

    if (!gameState) {
      return { success: false, error: 'Game not found' }
    }

    if (gameState.status !== 'active') {
      return { success: false, error: 'Game is not active' }
    }

    const playerColor = this.getPlayerColor(gameId, playerId)
    if (!playerColor) {
      return { success: false, error: 'Player not in this game' }
    }

    const currentOffer = gameState.drawOffer || { status: 'none' }
    if (currentOffer.status === 'pending') {
      if (currentOffer.byPlayerId === playerId) {
        return { success: false, error: 'You already offered a draw' }
      }
      return { success: false, error: 'Opponent draw offer is pending' }
    }

    gameState.drawOffer = {
      status: 'pending',
      byPlayerId: playerId,
      byColor: playerColor,
      createdAt: new Date()
    }
    gameState.updatedAt = new Date()

    return {
      success: true,
      action: 'offered',
      drawOffer: gameState.drawOffer
    }
  }

  respondDrawOffer(gameId, playerId, accept) {
    const gameState = this.games.get(gameId)

    if (!gameState) {
      return { success: false, error: 'Game not found' }
    }

    if (gameState.status !== 'active') {
      return { success: false, error: 'Game is not active' }
    }

    const playerColor = this.getPlayerColor(gameId, playerId)
    if (!playerColor) {
      return { success: false, error: 'Player not in this game' }
    }

    const currentOffer = gameState.drawOffer || { status: 'none' }
    if (currentOffer.status !== 'pending') {
      return { success: false, error: 'No draw offer pending' }
    }

    if (currentOffer.byPlayerId === playerId) {
      return { success: false, error: 'You cannot answer your own draw offer' }
    }

    if (!accept) {
      gameState.drawOffer = {
        status: 'none',
        byPlayerId: null,
        byColor: null,
        createdAt: null
      }
      gameState.updatedAt = new Date()
      return {
        success: true,
        action: 'declined',
        drawOffer: gameState.drawOffer
      }
    }

    gameState.status = 'completed'
    gameState.result = 'draw'
    gameState.endReason = 'draw-agreed'
    gameState.drawDetection = {
      is_draw: true,
      type: 'Agreement',
      automatic: false
    }
    gameState.endedAt = new Date()
    gameState.timers.lastTickAt = null
    gameState.drawOffer = {
      status: 'none',
      byPlayerId: null,
      byColor: null,
      createdAt: null
    }

    this.scheduleGameFinalization(gameState)

    return {
      success: true,
      action: 'accepted',
      result: gameState.result,
      status: gameState.status,
      drawOffer: gameState.drawOffer
    }
  }

  offerOrAcceptRematch(gameId, playerId) {
    const gameState = this.games.get(gameId)

    if (!gameState) {
      return { success: false, error: 'Game not found' }
    }

    if (gameState.status !== 'completed') {
      return { success: false, error: 'Rematch available only after game completion' }
    }

    const playerColor = this.getPlayerColor(gameId, playerId)
    if (!playerColor) {
      return { success: false, error: 'Player not in this game' }
    }

    if (!gameState.players.white.id || !gameState.players.black.id) {
      return { success: false, error: 'Both players are required for rematch' }
    }

    const currentOffer = gameState.rematchOffer || { status: 'none' }
    if (currentOffer.status !== 'pending') {
      gameState.rematchOffer = {
        status: 'pending',
        byPlayerId: playerId,
        byColor: playerColor,
        createdAt: new Date(),
        rematchGameId: null
      }
      gameState.updatedAt = new Date()
      return {
        success: true,
        action: 'offered',
        rematchOffer: gameState.rematchOffer
      }
    }

    if (currentOffer.byPlayerId === playerId) {
      return { success: false, error: 'You already offered rematch' }
    }

    const rematchGameId = uuidv4()
    const rematchTimeControl = this.normalizeTimeControl(gameState)
    const rematchSeconds = Math.floor(rematchTimeControl.baseTimeMs / 1000)
    const rematchIncrementSeconds = Math.floor(rematchTimeControl.incrementMs / 1000)
    const rematchGame = {
      gameId: rematchGameId,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      startedAt: new Date(),
      endedAt: null,
      initialFen: new Chess().fen(),
      gameMode: gameState.gameMode || 'casual',
      rated: Boolean(gameState.rated),
      variant: gameState.variant || 'standard',
      timeControl: rematchTimeControl,
      players: {
        white: {
          id: gameState.players.black.id,
          socketId: null,
          username: gameState.players.black.username,
          email: gameState.players.black.email || null,
          ratingSnapshot: gameState.players.black.ratingSnapshot || 100
        },
        black: {
          id: gameState.players.white.id,
          socketId: null,
          username: gameState.players.white.username,
          email: gameState.players.white.email || null,
          ratingSnapshot: gameState.players.white.ratingSnapshot || 100
        }
      },
      currentTurn: 'white',
      board: {
        fen: new Chess().fen(),
        pgn: new Chess().pgn(),
        moves: [],
        moveCount: 0
      },
      moveHistory: [],
      fenHistory: [new Chess().fen()],
      repetitionCount: {
        [this.normalizeRepetitionFen(new Chess().fen())]: 1
      },
      timers: {
        mode: rematchTimeControl.label,
        whiteRemaining: rematchSeconds,
        blackRemaining: rematchSeconds,
        incrementSeconds: rematchIncrementSeconds,
        activeColor: 'white',
        lastTickAt: null
      },
      firstMovePending: true,
      firstMoveDeadlineAt: Date.now() + 30000,
      drawOffer: {
        status: 'none',
        byPlayerId: null,
        byColor: null,
        createdAt: null
      },
      rematchOffer: {
        status: 'none',
        byPlayerId: null,
        byColor: null,
        createdAt: null,
        rematchGameId: null
      },
      drawDetection: {
        is_draw: false,
        type: null,
        automatic: false
      },
      result: null
    }

    this.games.set(rematchGameId, rematchGame)
    this.playerGames.set(rematchGame.players.white.id, rematchGameId)
    this.playerGames.set(rematchGame.players.black.id, rematchGameId)

    gameState.rematchOffer = {
      status: 'none',
      byPlayerId: null,
      byColor: null,
      createdAt: null,
      rematchGameId
    }
    gameState.updatedAt = new Date()

    return {
      success: true,
      action: 'accepted',
      rematchGame: {
        gameId: rematchGameId,
        status: rematchGame.status,
        board: rematchGame.board,
        timers: this.buildTimerSnapshot(rematchGame),
        players: rematchGame.players,
        playerColors: {
          [rematchGame.players.white.id]: 'white',
          [rematchGame.players.black.id]: 'black'
        }
      }
    }
  }

  /**
   * Get list of active games
   * @returns {Array} Array of game info
   */
  getActiveGames() {
    const activeGames = []

    for (const [gameId, gameState] of this.games.entries()) {
      this.updateClock(gameState)

      if (gameState.status === 'waiting' || gameState.status === 'active') {
        activeGames.push({
          gameId,
          status: gameState.status,
          gameMode: gameState.gameMode || 'casual',
          rated: Boolean(gameState.rated),
          variant: gameState.variant || 'standard',
          timeControl: gameState.timeControl || null,
          whitePlayer: gameState.players.white.username,
          blackPlayer: gameState.players.black.username,
          timers: this.buildTimerSnapshot(gameState),
          moveCount: gameState.board.moveCount,
          createdAt: gameState.createdAt,
          startedAt: gameState.startedAt
        })
      }
    }

    return activeGames
  }

  /**
   * Find a waiting game that the player can join.
   * @param {string} playerId
   * @returns {string|null}
   */
  computeRatingWindow(waitMs) {
    const safeWait = Math.max(0, Number(waitMs || 0))
    const bucket = Math.floor(safeWait / 15000)
    return Math.min(400, 100 + bucket * 100)
  }

  findJoinableWaitingGame(playerId, options = {}) {
    const requestedMode = this.normalizeMatchMode(options.gameMode)
    const requestedVariant = String(options.variant || 'standard')
    const requestedControl = this.normalizeTimeControl(options)
    const requesterRating = Number(options.rating || 100)
    const requestedColorPreference = this.normalizeColorPreference(options.colorPreference)
    const now = Date.now()

    for (const [gameId, gameState] of this.games.entries()) {
      if (gameState.status !== 'waiting') continue
      if (gameState.players.white.id === playerId) continue
      if (gameState.players.black.id === playerId) continue

      if (this.normalizeMatchMode(gameState.gameMode) !== requestedMode) continue
      if (String(gameState.variant || 'standard') !== requestedVariant) continue

      const waitingControl = this.normalizeTimeControl(gameState)
      if (waitingControl.preset !== requestedControl.preset) continue

      const openSeatColor = this.getOpenSeatColor(gameState)
      if (!openSeatColor) continue
      if (!this.isColorCompatible(requestedColorPreference, openSeatColor)) continue

      const hostRating = gameState.players?.white?.id
        ? gameState.players.white.ratingSnapshot
        : gameState.players?.black?.ratingSnapshot
      const waitingRating = Number(hostRating || 100)
      const waitingAge = now - Number(gameState.queueJoinedAt || now)
      const allowedDiff = Math.max(this.computeRatingWindow(0), this.computeRatingWindow(waitingAge))
      if (Math.abs(waitingRating - requesterRating) > allowedDiff) continue

      return gameId
    }

    return null
  }

  /**
   * Join a waiting game if available; otherwise create a new one.
   * @param {string} playerId
   * @param {Object} options
   * @returns {{action: string, success: boolean, data?: Object, error?: string}}
   */
  async quickJoinOrCreate(playerId, options = {}) {
    const requestedColorPreference = this.normalizeColorPreference(options.colorPreference)
    const queuePayload = {
      mode: this.normalizeMatchMode(options.gameMode),
      preset: this.normalizeTimeControl(options).preset,
      variant: String(options.variant || 'standard'),
      requesterPlayerId: playerId,
      requesterRating: Number(options.rating || 100),
      requesterColorPreference: requestedColorPreference
    }

    const attemptJoin = (gameId) => {
      if (!gameId) return null
      const joined = this.joinGame(gameId, playerId, options.username, options.rating, requestedColorPreference, options.email)
      if (!joined.success) return null
      return {
        action: 'joined',
        success: true,
        data: joined
      }
    }

    const redisMatch = await MatchmakingQueueService.findBestMatch(queuePayload)
    const redisJoined = attemptJoin(redisMatch?.gameId)
    if (redisJoined) {
      return redisJoined
    }

    const immediateFallback = attemptJoin(this.findJoinableWaitingGame(playerId, options))
    if (immediateFallback) {
      return immediateFallback
    }

    const created = this.createGame(playerId, options)
    const enqueuePayload = {
      ...queuePayload,
      gameId: created.gameId,
      hostPlayerId: playerId,
      hostRating: Number(options.rating || 100),
      hostOpenSeatColor: created.openSeatColor,
      hostColorPreference: created.colorPreference,
      queuedAt: Date.now()
    }
    await MatchmakingQueueService.enqueue(enqueuePayload)

    return {
      action: 'created',
      success: true,
      data: created
    }
  }

  /**
   * End a game (for cleanup)
   * @param {string} gameId - Game room ID
   * @returns {boolean} Success
   */
  endGame(gameId) {
    const gameState = this.games.get(gameId)

    if (!gameState) return false

    // Remove player mappings
    if (gameState.players.white.id) {
      this.playerGames.delete(gameState.players.white.id)
    }
    if (gameState.players.black.id) {
      this.playerGames.delete(gameState.players.black.id)
    }

    // Mark as completed if not already
    if (gameState.status !== 'completed') {
      gameState.status = 'completed'
      gameState.endReason = gameState.endReason || 'manual-end'
      gameState.endedAt = new Date()
    }

    this.scheduleGameFinalization(gameState)

    Promise.resolve(MatchmakingQueueService.removeByGameId({
      mode: gameState.gameMode,
      preset: gameState.timeControl?.preset,
      variant: gameState.variant,
      gameId
    })).catch(() => {})

    return true
  }

  /**
   * Get game by player ID
   * @param {string} playerId - Player ID
   * @returns {Object} Game state or null
   */
  getGameByPlayerId(playerId) {
    const gameId = this.playerGames.get(playerId)
    if (!gameId) return null

    return this.getGameState(gameId)
  }

  getGameById(gameId) {
    return this.games.get(gameId) || null
  }

  /**
   * Get completed games for archive/review.
   * @param {number} max
   * @returns {Array}
   */
  async getCompletedGames(max = 20, playerId = null, playerEmail = null) {
    await this.flushArchivedGamesToDb()

    const safeMax = Math.max(1, Number(max || 20))
    const normalizedPlayerId = playerId ? String(playerId) : ''
    const normalizedPlayerEmail = String(playerEmail || '').trim().toLowerCase()
    const rows = []

    if (this.isDbReady()) {
      const ownershipFilters = []
      if (normalizedPlayerId) {
        ownershipFilters.push(
          { 'whitePlayer.userId': normalizedPlayerId },
          { 'blackPlayer.userId': normalizedPlayerId }
        )
      }
      if (normalizedPlayerEmail) {
        ownershipFilters.push(
          { 'whitePlayer.email': normalizedPlayerEmail },
          { 'blackPlayer.email': normalizedPlayerEmail }
        )
      }

      const query = ownershipFilters.length ? { $or: ownershipFilters } : {}

      const persisted = await GameRecord.find(query)
        .sort({ endedAtGame: -1, createdAt: -1 })
        .limit(safeMax)
        .lean()

      for (const row of persisted) {
        rows.push({
          gameId: row.gameId,
          status: row.status,
          result: row.result,
          reason: row.reason || null,
          whitePlayer: row.whitePlayer?.username || 'White',
          blackPlayer: row.blackPlayer?.username || 'Black',
          whiteEmail: row.whitePlayer?.email || null,
          blackEmail: row.blackPlayer?.email || null,
          createdAt: row.createdAtGame || row.createdAt,
          startedAt: row.startedAtGame || null,
          endedAt: row.endedAtGame || row.updatedAt,
          initialFen: row.initialFen || new Chess().fen(),
          fen: row.finalFen || new Chess().fen(),
          pgn: row.pgn || '',
          moves: row.moves || [],
          analysis: row.analysis || null
          ,drawDetection: row.drawDetection || { is_draw: false, type: null, automatic: false }
        })
      }
    }

    for (const row of this.archivedGames.values()) {
      if (normalizedPlayerId || normalizedPlayerEmail) {
        const rowWhiteId = String(row?.whitePlayer?.userId || '')
        const rowBlackId = String(row?.blackPlayer?.userId || '')
        const rowWhiteEmail = String(row?.whitePlayer?.email || '').toLowerCase()
        const rowBlackEmail = String(row?.blackPlayer?.email || '').toLowerCase()
        const idMatch = normalizedPlayerId
          ? (rowWhiteId === normalizedPlayerId || rowBlackId === normalizedPlayerId)
          : false
        const emailMatch = normalizedPlayerEmail
          ? (rowWhiteEmail === normalizedPlayerEmail || rowBlackEmail === normalizedPlayerEmail)
          : false
        const isParticipant = idMatch || emailMatch
        if (!isParticipant) continue
      }

      rows.push({
        gameId: row.gameId,
        status: row.status,
        result: row.result,
        reason: row.reason || null,
        whitePlayer: row.whitePlayer?.username || 'White',
        blackPlayer: row.blackPlayer?.username || 'Black',
        whiteEmail: row.whitePlayer?.email || null,
        blackEmail: row.blackPlayer?.email || null,
        createdAt: row.createdAtGame || row.createdAt,
        startedAt: row.startedAtGame || null,
        endedAt: row.endedAtGame || row.endedAt,
        initialFen: row.initialFen || new Chess().fen(),
        fen: row.finalFen || new Chess().fen(),
        pgn: row.pgn || '',
        moves: row.moves || [],
        analysis: row.analysis || null,
        drawDetection: row.drawDetection || { is_draw: false, type: null, automatic: false }
      })
    }

    for (const [gameId, gameState] of this.games.entries()) {
      if (gameState.status !== 'completed') continue

      if (normalizedPlayerId || normalizedPlayerEmail) {
        const stateWhiteId = String(gameState.players?.white?.id || '')
        const stateBlackId = String(gameState.players?.black?.id || '')
        const stateWhiteEmail = String(gameState.players?.white?.email || '').toLowerCase()
        const stateBlackEmail = String(gameState.players?.black?.email || '').toLowerCase()
        const idMatch = normalizedPlayerId
          ? (stateWhiteId === normalizedPlayerId || stateBlackId === normalizedPlayerId)
          : false
        const emailMatch = normalizedPlayerEmail
          ? (stateWhiteEmail === normalizedPlayerEmail || stateBlackEmail === normalizedPlayerEmail)
          : false
        const isParticipant = idMatch || emailMatch
        if (!isParticipant) continue
      }

      rows.push({
        gameId,
        status: gameState.status,
        result: gameState.result,
        reason: gameState.endReason || null,
        whitePlayer: gameState.players.white.username,
        blackPlayer: gameState.players.black.username,
        whiteEmail: gameState.players.white.email || null,
        blackEmail: gameState.players.black.email || null,
        createdAt: gameState.createdAt,
        startedAt: gameState.startedAt,
        endedAt: gameState.endedAt,
        initialFen: gameState.initialFen || new Chess().fen(),
        fen: gameState.board.fen,
        pgn: gameState.board.pgn,
        moves: gameState.moveHistory,
        analysis: gameState.archiveRecord?.analysis || this.buildGameAnalysis(gameState),
        drawDetection: gameState.drawDetection || { is_draw: false, type: null, automatic: false }
      })
    }

    const uniqueRows = Array.from(
      rows.reduce((acc, row) => {
        const key = String(row.gameId)
        if (!acc.has(key)) {
          acc.set(key, row)
        }
        return acc
      }, new Map()).values()
    )

    return uniqueRows
      .sort((a, b) => new Date(b.endedAt || b.startedAt || b.createdAt) - new Date(a.endedAt || a.startedAt || a.createdAt))
      .slice(0, safeMax)
  }

  async getCompletedGamesByUsername(username, max = 20) {
    const needle = String(username || '').trim().toLowerCase()
    if (!needle) return []

    const safeMax = Math.max(1, Number(max || 20))
    const preload = Math.max(80, safeMax * 8)
    const rows = await this.getCompletedGames(preload, null, null)

    return rows
      .filter((row) => {
        const white = String(row?.whitePlayer || '').trim().toLowerCase()
        const black = String(row?.blackPlayer || '').trim().toLowerCase()
        return white === needle || black === needle
      })
      .slice(0, safeMax)
  }

  /**
   * Export game as PGN
   * @param {string} gameId - Game room ID
   * @returns {string} PGN notation
   */
  exportGamePGN(gameId) {
    const gameState = this.games.get(gameId)

    if (!gameState) return null

    const game = new Chess(gameState.board.fen)
    let pgn = ''

    // Add metadata
    pgn += `[Event "Chess Game"]\n`
    pgn += `[Site "Chess App"]\n`
    pgn += `[Date "${gameState.createdAt.toISOString().split('T')[0]}"]\n`
    pgn += `[White "${gameState.players.white.username}"]\n`
    pgn += `[Black "${gameState.players.black.username || 'Anonymous'}"]\n`
    pgn += `[Result "${gameState.result === 'white-win' ? '1-0' : gameState.result === 'black-win' ? '0-1' : gameState.result === 'draw' ? '1/2-1/2' : '*'}"]\n\n`

    pgn += gameState.board.pgn

    return pgn
  }
}

export default new GameService()
