import express from 'express'
import GameController from '../controllers/gameController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

// POST /api/game/create
router.post('/create', requireAuth, GameController.createGame)

// POST /api/game/quick-join
router.post('/quick-join', requireAuth, GameController.quickJoinOrCreate)

// POST /api/game/join
router.post('/join', requireAuth, GameController.joinGameRoom)

// GET /api/game/
router.get('/', GameController.getSimpleGameList)

// GET /api/game/completed
router.get('/completed', requireAuth, GameController.getCompletedGames)

// GET /api/game/completed/by-username/:username
router.get('/completed/by-username/:username', GameController.getCompletedGamesByUsername)

// POST /api/game/:gameId/draw
router.post('/:gameId/draw', requireAuth, GameController.drawGame)

// POST /api/game/:gameId/resign
router.post('/:gameId/resign', requireAuth, GameController.resignGame)

export default router
