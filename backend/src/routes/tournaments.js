import express from 'express'
import TournamentController from '../controllers/tournamentController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/', TournamentController.list)
router.get('/:id', TournamentController.getById)
router.get('/:id/leaderboard', TournamentController.leaderboard)
router.post('/', requireAuth, TournamentController.create)
router.post('/:id/join', requireAuth, TournamentController.join)
router.post('/:id/start', requireAuth, TournamentController.start)

export default router
