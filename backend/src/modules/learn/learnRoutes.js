import express from 'express'
import LearnController from './LearnController.js'

const router = express.Router()

// GET /api/learn/curriculum
router.get('/curriculum', LearnController.getCurriculum)

// GET /api/learn/category/:categoryId
router.get('/category/:categoryId', LearnController.getCategory)

// GET /api/learn/stage/:stageId
router.get('/stage/:stageId', LearnController.getStage)

// GET /api/learn/progress
router.get('/progress', LearnController.getUserProgress)

// POST /api/learn/progress
router.post('/progress', LearnController.updateLessonProgress)

// GET /api/learn/achievements
router.get('/achievements', LearnController.getAchievements)

// GET /api/learn/skill-ratings
router.get('/skill-ratings', LearnController.getSkillRatings)

export default router
