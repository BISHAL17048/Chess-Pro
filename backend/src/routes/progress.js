import express from 'express'
import mongoose from 'mongoose'
import { requireAuth } from '../middleware/authMiddleware.js'
import UserProgress from '../models/UserProgress.js'

const router = express.Router()

async function getOrCreateProgress(userId) {
  let progress = await UserProgress.findOne({ userId })
  if (!progress) {
    progress = await UserProgress.create({ userId })
  }
  return progress
}

function isDbReady() {
  return mongoose.connection.readyState === 1
}

router.get('/overview', requireAuth, async (req, res) => {
  try {
    if (!isDbReady()) {
      res.json({
        success: true,
        data: {
          learn: { botGamesPlayed: 0, botGamesWon: 0, lastBotId: 'nelson', streakDays: 0, totalStudyMinutes: 0 },
          puzzles: { solved: 0, mistakes: 0, bestStreak: 0, currentStreak: 0, lastTheme: 'mix' },
          play: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0, favoriteTimeControl: '5+0' },
          watch: { gamesWatched: 0, lastSource: 'tournament' }
        }
      })
      return
    }

    const progress = await getOrCreateProgress(req.auth.sub)
    res.json({ success: true, data: progress })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch progress' })
  }
})

router.post('/learn/session', requireAuth, async (req, res) => {
  try {
    if (!isDbReady()) {
      res.json({ success: true, data: { persisted: false } })
      return
    }

    const { botId = 'nelson', won = false, studyMinutes = 0 } = req.body || {}
    const progress = await getOrCreateProgress(req.auth.sub)

    progress.learn.botGamesPlayed += 1
    if (won) progress.learn.botGamesWon += 1
    progress.learn.lastBotId = String(botId || 'nelson')
    progress.learn.totalStudyMinutes += Math.max(0, Number(studyMinutes) || 0)

    await progress.save()
    res.json({ success: true, data: progress.learn })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to save learn session' })
  }
})

router.post('/learn/profile', requireAuth, async (req, res) => {
  try {
    if (!isDbReady()) {
      res.json({ success: true, data: { persisted: false } })
      return
    }

    const { botId = 'nelson' } = req.body || {}
    const progress = await getOrCreateProgress(req.auth.sub)
    progress.learn.lastBotId = String(botId || 'nelson')

    await progress.save()
    res.json({ success: true, data: progress.learn })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to save learn profile' })
  }
})

router.post('/puzzles/attempt', requireAuth, async (req, res) => {
  try {
    if (!isDbReady()) {
      res.json({ success: true, data: { persisted: false } })
      return
    }

    const { solved = false, mistake = false, theme = 'mix' } = req.body || {}
    const progress = await getOrCreateProgress(req.auth.sub)

    if (mistake) {
      progress.puzzles.mistakes += 1
      progress.puzzles.currentStreak = 0
    }

    if (solved) {
      progress.puzzles.solved += 1
      progress.puzzles.currentStreak += 1
      if (progress.puzzles.currentStreak > progress.puzzles.bestStreak) {
        progress.puzzles.bestStreak = progress.puzzles.currentStreak
      }
    }

    progress.puzzles.lastTheme = String(theme || 'mix')

    await progress.save()
    res.json({ success: true, data: progress.puzzles })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to save puzzle attempt' })
  }
})

router.post('/play/match', requireAuth, async (req, res) => {
  try {
    if (!isDbReady()) {
      res.json({ success: true, data: { persisted: false } })
      return
    }

    const { result = 'draw', timeControl = '5+0' } = req.body || {}
    const progress = await getOrCreateProgress(req.auth.sub)

    progress.play.gamesPlayed += 1
    progress.play.favoriteTimeControl = String(timeControl || '5+0')

    if (result === 'win') progress.play.wins += 1
    else if (result === 'loss') progress.play.losses += 1
    else progress.play.draws += 1

    await progress.save()
    res.json({ success: true, data: progress.play })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to save play match' })
  }
})

router.post('/play/preset', requireAuth, async (req, res) => {
  try {
    if (!isDbReady()) {
      res.json({ success: true, data: { persisted: false } })
      return
    }

    const { timeControl = '5+0' } = req.body || {}
    const progress = await getOrCreateProgress(req.auth.sub)
    progress.play.favoriteTimeControl = String(timeControl || '5+0')

    await progress.save()
    res.json({ success: true, data: progress.play })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to save play preset' })
  }
})

router.post('/watch/view', requireAuth, async (req, res) => {
  try {
    if (!isDbReady()) {
      res.json({ success: true, data: { persisted: false } })
      return
    }

    const { source = 'tournament' } = req.body || {}
    const progress = await getOrCreateProgress(req.auth.sub)

    progress.watch.gamesWatched += 1
    progress.watch.lastSource = String(source || 'tournament')

    await progress.save()
    res.json({ success: true, data: progress.watch })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to save watch activity' })
  }
})

export default router
