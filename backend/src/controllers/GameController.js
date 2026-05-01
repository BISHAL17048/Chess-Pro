import GameService from '../services/GameService.js'
import User from '../models/User.js'

async function resolvePlayerIdentity(req) {
  const requestedCategory = String(
    req.body?.timeControl?.category
      || req.body?.timeCategory
      || 'blitz'
  ).toLowerCase()

  const ratingKey = ['bullet', 'blitz', 'rapid'].includes(requestedCategory)
    ? requestedCategory
    : requestedCategory === 'classical'
      ? 'rapid'
    : 'blitz'

  const tokenUserId = req.auth?.sub
  if (tokenUserId) {
    const user = await User.findById(tokenUserId).select('_id username email ratings')
    if (!user) {
      return {
        ok: false,
        status: 401,
        error: 'Authenticated user not found'
      }
    }

    return {
      ok: true,
      playerId: user._id.toString(),
      username: user.username,
      email: user.email || null,
      rating: Number(user?.ratings?.[ratingKey] || 100)
    }
  }

  const { playerId, username } = req.body || {}
  if (!playerId) {
    return {
      ok: false,
      status: 400,
      error: 'playerId is required'
    }
  }

  return {
    ok: true,
    playerId,
    username: username || undefined,
    email: undefined,
    rating: 100
  }
}

/**
 * GameController - Handles game-related API requests
 */
class GameController {
  static resolveColorPreference() {
    return 'random'
  }

  /**
   * Join an existing game room using request body gameId
   * POST /api/game/join
   */
  static async joinGameRoom(req, res) {
    try {
      const { gameId } = req.body

      if (!gameId) {
        return res.status(400).json({
          success: false,
          error: 'gameId is required'
        })
      }

      const identity = await resolvePlayerIdentity(req)
      if (!identity.ok) {
        return res.status(identity.status).json({
          success: false,
          error: identity.error
        })
      }

      const result = GameService.joinGame(
        gameId,
        identity.playerId,
        identity.username,
        identity.rating,
        GameController.resolveColorPreference(),
        identity.email
      )

      if (!result.success) {
        return res.status(400).json(result)
      }

      return res.status(200).json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Error joining game room:', error)
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get simple game room list
   * GET /api/game/
   */
  static getSimpleGameList(req, res) {
    try {
      const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : ''
      const games = GameService.getActiveGames().filter((game) => {
        if (!statusFilter) return true
        return game.status === statusFilter
      })

      return res.status(200).json({
        success: true,
        data: games,
        count: games.length
      })
    } catch (error) {
      console.error('Error getting simple game list:', error)
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Create a new game room
   * POST /api/games
   */
  static async createGame(req, res) {
    try {
      const { timeControlMinutes, timeControl, gameMode, variant } = req.body
      const identity = await resolvePlayerIdentity(req)
      if (!identity.ok) {
        return res.status(identity.status).json({
          success: false,
          error: identity.error
        })
      }

      const result = GameService.createGame(identity.playerId, {
        username: identity.username,
        email: identity.email,
        rating: identity.rating,
        timeControlMinutes,
        timeControl,
        gameMode,
        variant,
        colorPreference: GameController.resolveColorPreference()
      })

      res.status(201).json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Error creating game:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Quick join a waiting live game or create one if none are available.
   * POST /api/game/quick-join
   */
  static async quickJoinOrCreate(req, res) {
    try {
      const { timeControlMinutes, timeControl, gameMode, variant } = req.body
      const identity = await resolvePlayerIdentity(req)
      if (!identity.ok) {
        return res.status(identity.status).json({
          success: false,
          error: identity.error
        })
      }

      const result = await GameService.quickJoinOrCreate(identity.playerId, {
        username: identity.username,
        email: identity.email,
        rating: identity.rating,
        timeControlMinutes,
        timeControl,
        gameMode,
        variant,
        colorPreference: GameController.resolveColorPreference()
      })

      if (!result.success) {
        return res.status(400).json(result)
      }

      return res.status(200).json({
        success: true,
        action: result.action,
        data: result.data
      })
    } catch (error) {
      console.error('Error quick joining game:', error)
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Join an existing game
   * POST /api/games/:gameId/join
   */
  static async joinGame(req, res) {
    try {
      const { gameId } = req.params
      const identity = await resolvePlayerIdentity(req)
      if (!identity.ok) {
        return res.status(identity.status).json({
          success: false,
          error: identity.error
        })
      }

      const result = GameService.joinGame(
        gameId,
        identity.playerId,
        identity.username,
        identity.rating,
        GameController.resolveColorPreference(),
        identity.email
      )

      if (!result.success) {
        return res.status(400).json(result)
      }

      res.status(200).json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Error joining game:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get game state
   * GET /api/games/:gameId
   */
  static getGame(req, res) {
    try {
      const { gameId } = req.params

      const gameState = GameService.getGameState(gameId)

      if (!gameState) {
        return res.status(404).json({
          success: false,
          error: 'Game not found'
        })
      }

      res.status(200).json({
        success: true,
        data: gameState
      })
    } catch (error) {
      console.error('Error getting game:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get board state of a game
   * GET /api/games/:gameId/board
   */
  static getBoardState(req, res) {
    try {
      const { gameId } = req.params

      const boardState = GameService.getBoardState(gameId)

      if (!boardState) {
        return res.status(404).json({
          success: false,
          error: 'Game not found'
        })
      }

      res.status(200).json({
        success: true,
        data: boardState
      })
    } catch (error) {
      console.error('Error getting board state:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Make a move in a game
   * POST /api/games/:gameId/move
   */
  static makeMove(req, res) {
    try {
      const { gameId } = req.params
      const { playerId, from, to, promotion } = req.body

      if (!playerId || !from || !to) {
        return res.status(400).json({
          success: false,
          error: 'playerId, from, and to are required'
        })
      }

      const result = GameService.makeMove(gameId, playerId, {
        from,
        to,
        promotion
      })

      if (!result.success) {
        return res.status(400).json(result)
      }

      res.status(200).json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Error making move:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get legal moves for a piece
   * GET /api/games/:gameId/moves?square=e4
   */
  static getLegalMoves(req, res) {
    try {
      const { gameId } = req.params
      const { square } = req.query

      if (!square) {
        return res.status(400).json({
          success: false,
          error: 'square query parameter is required'
        })
      }

      const moves = GameService.getLegalMoves(gameId, square)

      res.status(200).json({
        success: true,
        data: {
          square,
          legalMoves: moves,
          moveCount: moves.length
        }
      })
    } catch (error) {
      console.error('Error getting legal moves:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get all legal moves in current position
   * GET /api/games/:gameId/all-moves
   */
  static getAllLegalMoves(req, res) {
    try {
      const { gameId } = req.params

      const moves = GameService.getAllLegalMoves(gameId)

      res.status(200).json({
        success: true,
        data: {
          moves,
          moveCount: moves.length
        }
      })
    } catch (error) {
      console.error('Error getting all legal moves:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Resign from a game
   * POST /api/games/:gameId/resign
   */
  static async resignGame(req, res) {
    try {
      const { gameId } = req.params
      const identity = await resolvePlayerIdentity(req)
      if (!identity.ok) {
        return res.status(identity.status).json({
          success: false,
          error: identity.error
        })
      }

      const result = GameService.resignGame(gameId, identity.playerId)

      if (!result.success) {
        return res.status(400).json(result)
      }

      res.status(200).json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Error resigning game:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Accept draw and finish game.
   * POST /api/games/:gameId/draw
   */
  static async drawGame(req, res) {
    try {
      const { gameId } = req.params
      const identity = await resolvePlayerIdentity(req)
      if (!identity.ok) {
        return res.status(identity.status).json({
          success: false,
          error: identity.error
        })
      }

      const result = GameService.drawGame(gameId, identity.playerId)
      if (!result.success) {
        return res.status(400).json(result)
      }

      return res.status(200).json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Error drawing game:', error)
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get list of active games
   * GET /api/games
   */
  static getActiveGames(req, res) {
    try {
      const games = GameService.getActiveGames()

      res.status(200).json({
        success: true,
        data: games,
        count: games.length
      })
    } catch (error) {
      console.error('Error getting active games:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get completed games for review.
   * GET /api/games/completed
   */
  static async getCompletedGames(req, res) {
    try {
      const max = Number(req.query.max) || 20
      const playerId = String(req.auth?.sub || '')
      const playerEmail = String(req.auth?.email || '').trim().toLowerCase()
      if (!playerId) {
        return res.status(401).json({
          success: false,
          error: 'Authorization token missing'
        })
      }

      const games = await GameService.getCompletedGames(max, playerId, playerEmail)

      return res.status(200).json({
        success: true,
        data: games,
        count: games.length
      })
    } catch (error) {
      console.error('Error getting completed games:', error)
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get completed games by username (public replay listing).
   * GET /api/game/completed/by-username/:username
   */
  static async getCompletedGamesByUsername(req, res) {
    try {
      const max = Number(req.query.max) || 20
      const username = String(req.params?.username || '').trim()

      if (!username) {
        return res.status(400).json({
          success: false,
          error: 'username is required'
        })
      }

      const games = await GameService.getCompletedGamesByUsername(username, max)

      return res.status(200).json({
        success: true,
        data: games,
        count: games.length
      })
    } catch (error) {
      console.error('Error getting completed games by username:', error)
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Export game as PGN
   * GET /api/games/:gameId/export
   */
  static exportGame(req, res) {
    try {
      const { gameId } = req.params

      const pgn = GameService.exportGamePGN(gameId)

      if (!pgn) {
        return res.status(404).json({
          success: false,
          error: 'Game not found'
        })
      }

      res.setHeader('Content-Type', 'text/plain')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="chess-game-${gameId}.pgn"`
      )
      res.send(pgn)
    } catch (error) {
      console.error('Error exporting game:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * Get player's current game
   * GET /api/players/:playerId/game
   */
  static getPlayerGame(req, res) {
    try {
      const { playerId } = req.params

      const game = GameService.getGameByPlayerId(playerId)

      if (!game) {
        return res.status(404).json({
          success: false,
          error: 'Player has no active game'
        })
      }

      res.status(200).json({
        success: true,
        data: game
      })
    } catch (error) {
      console.error('Error getting player game:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
}

export default GameController
