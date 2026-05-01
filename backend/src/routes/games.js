import express from 'express'
import GameController from '../controllers/GameController.js'
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

/**
 * Game Room APIs
 */

// Create a new game room
router.post('/', optionalAuth, GameController.createGame)

// Get list of active games
router.get('/', GameController.getActiveGames)

// Get specific game state
router.get('/:gameId', GameController.getGame)

// Get board state only
router.get('/:gameId/board', GameController.getBoardState)

// Join a game room
router.post('/:gameId/join', optionalAuth, GameController.joinGame)

/**
 * Move APIs
 */

// Make a move
router.post('/:gameId/move', optionalAuth, GameController.makeMove)

// Get legal moves for a square
router.get('/:gameId/moves', GameController.getLegalMoves)

// Get all legal moves
router.get('/:gameId/all-moves', GameController.getAllLegalMoves)

/**
 * Game Action APIs
 */

// Resign from game
router.post('/:gameId/resign', optionalAuth, GameController.resignGame)

// Draw game
router.post('/:gameId/draw', optionalAuth, GameController.drawGame)

// Completed games archive
router.get('/completed', optionalAuth, GameController.getCompletedGames)

// Export game as PGN
router.get('/:gameId/export', GameController.exportGame)

/**
 * Player APIs
 */

// Get player's current game
router.get('/player/:playerId', GameController.getPlayerGame)

export default router
