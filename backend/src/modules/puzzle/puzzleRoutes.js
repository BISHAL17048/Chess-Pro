import express from 'express'
import PuzzleController from './PuzzleController.js'

const router = express.Router()

// GET /api/puzzle/random
router.get('/random', PuzzleController.getRandomPuzzle)

// GET /api/puzzle/daily
router.get('/daily', PuzzleController.getDailyPuzzle)

export default router
