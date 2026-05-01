import { getAllLessons, getLessonCategory, LESSON_CATEGORIES, ACHIEVEMENTS, SKILL_RATINGS } from './lessons.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const levelsPath = path.join(__dirname, 'levels.json')
const progressPath = path.join(__dirname, 'progress.json')
let levelsCache = null
let progressCache = null

// Helper functions for progress management
const loadProgress = () => {
  if (progressCache) return progressCache
  if (fs.existsSync(progressPath)) {
    progressCache = JSON.parse(fs.readFileSync(progressPath, 'utf8'))
  } else {
    progressCache = {}
  }
  return progressCache
}

const saveProgress = (progress) => {
  progressCache = progress
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2))
}

export default class LearnController {
  static async getCurriculum(req, res) {
    try {
      const lessons = getAllLessons()
      return res.status(200).json({
        success: true,
        data: lessons
      })
    } catch (error) {
      console.error('Error fetching learn curriculum:', error)
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  static async getCategory(req, res) {
    try {
      const { categoryId } = req.params
      const category = getLessonCategory(categoryId)
      
      if (!category) {
        return res.status(404).json({
          success: false,
          error: 'Category not found'
        })
      }

      return res.status(200).json({
        success: true,
        data: category
      })
    } catch (error) {
      console.error('Error fetching learn category:', error)
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  static async getStage(req, res) {
    try {
      if (!levelsCache) {
        if (fs.existsSync(levelsPath)) {
          levelsCache = JSON.parse(fs.readFileSync(levelsPath, 'utf8'))
        } else {
          levelsCache = {}
        }
      }

      const { stageId } = req.params
      const levels = levelsCache[stageId]

      if (!levels) {
        return res.status(404).json({
          success: false,
          error: 'Stage levels not found'
        })
      }

      return res.status(200).json({
        success: true,
        data: levels
      })
    } catch (error) {
      console.error('Error fetching stage:', error)
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  static async getUserProgress(req, res) {
    try {
      const userId = req.user?.id || req.body?.userId || 'anonymous'
      const progress = loadProgress()
      const userProgress = progress[userId] || {
        completedLessons: [],
        achievements: [],
        skillRatings: { ...SKILL_RATINGS },
        totalLessonsCompleted: 0,
        totalTimeSpent: 0,
        streak: 0,
        lastStudyDate: null
      }

      return res.status(200).json({
        success: true,
        data: userProgress
      })
    } catch (error) {
      console.error('Error fetching user progress:', error)
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  static async updateLessonProgress(req, res) {
    try {
      const { lessonId, categoryId, completed, mistakes, timeSpent, perfectScore } = req.body
      const userId = req.user?.id || req.body?.userId || 'anonymous'

      if (!lessonId || !categoryId) {
        return res.status(400).json({
          success: false,
          error: 'lessonId and categoryId are required'
        })
      }

      const progress = loadProgress()
      if (!progress[userId]) {
        progress[userId] = {
          completedLessons: [],
          achievements: [],
          skillRatings: { ...SKILL_RATINGS },
          totalLessonsCompleted: 0,
          totalTimeSpent: 0,
          streak: 0,
          lastStudyDate: null
        }
      }

      const userProgress = progress[userId]
      
      // Check if lesson already completed
      const existingLesson = userProgress.completedLessons.find(l => l.lessonId === lessonId)
      
      if (completed && !existingLesson) {
        userProgress.completedLessons.push({
          lessonId,
          categoryId,
          completedAt: new Date().toISOString(),
          mistakes,
          timeSpent,
          perfectScore
        })
        userProgress.totalLessonsCompleted += 1
        userProgress.totalTimeSpent += timeSpent || 0

        // Update skill rating based on category
        if (userProgress.skillRatings[categoryId]) {
          const ratingIncrease = perfectScore ? 25 : Math.max(5, 20 - mistakes)
          userProgress.skillRatings[categoryId].rating = Math.min(
            2000,
            userProgress.skillRatings[categoryId].rating + ratingIncrease
          )
        }

        // Check for achievements
        const newAchievements = LearnController.checkAchievements(userProgress)
        userProgress.achievements = [...new Set([...userProgress.achievements, ...newAchievements])]

        // Update streak
        const today = new Date().toDateString()
        if (userProgress.lastStudyDate !== today) {
          const yesterday = new Date(Date.now() - 86400000).toDateString()
          if (userProgress.lastStudyDate === yesterday) {
            userProgress.streak += 1
          } else {
            userProgress.streak = 1
          }
          userProgress.lastStudyDate = today
        }
      } else if (existingLesson && completed) {
        // Update existing lesson if better score
        if (perfectScore && !existingLesson.perfectScore) {
          existingLesson.perfectScore = true
          existingLesson.mistakes = mistakes
          existingLesson.timeSpent = timeSpent
        }
      }

      saveProgress(progress)

      return res.status(200).json({
        success: true,
        data: userProgress
      })
    } catch (error) {
      console.error('Error updating lesson progress:', error)
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  static async getAchievements(req, res) {
    try {
      const userId = req.user?.id || req.query?.userId || 'anonymous'
      const progress = loadProgress()
      const userProgress = progress[userId] || { achievements: [] }

      const allAchievements = Object.values(ACHIEVEMENTS).map(achievement => ({
        ...achievement,
        unlocked: userProgress.achievements.includes(achievement.id)
      }))

      return res.status(200).json({
        success: true,
        data: allAchievements
      })
    } catch (error) {
      console.error('Error fetching achievements:', error)
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  static async getSkillRatings(req, res) {
    try {
      const userId = req.user?.id || req.query?.userId || 'anonymous'
      const progress = loadProgress()
      const userProgress = progress[userId] || { skillRatings: { ...SKILL_RATINGS } }

      return res.status(200).json({
        success: true,
        data: userProgress.skillRatings
      })
    } catch (error) {
      console.error('Error fetching skill ratings:', error)
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  static checkAchievements(userProgress) {
    const newAchievements = []
    const completedLessons = userProgress.completedLessons

    // First lesson
    if (completedLessons.length === 1 && !userProgress.achievements.includes('first_lesson')) {
      newAchievements.push('first_lesson')
    }

    // Perfect score
    const lastLesson = completedLessons[completedLessons.length - 1]
    if (lastLesson?.perfectScore && !userProgress.achievements.includes('perfect_score')) {
      newAchievements.push('perfect_score')
    }

    // Basics master
    const basicsCompleted = completedLessons.filter(l => l.categoryId === 'basics').length
    if (basicsCompleted >= 8 && !userProgress.achievements.includes('basics_master')) {
      newAchievements.push('basics_master')
    }

    // Tactics expert
    const tacticsCompleted = completedLessons.filter(l => l.categoryId === 'tactics').length
    if (tacticsCompleted >= 10 && !userProgress.achievements.includes('tactics_expert')) {
      newAchievements.push('tactics_expert')
    }

    // Endgame king
    const endgamesCompleted = completedLessons.filter(l => l.categoryId === 'endgames').length
    if (endgamesCompleted >= 8 && !userProgress.achievements.includes('endgame_king')) {
      newAchievements.push('endgame_king')
    }

    // Opening scholar
    const openingsCompleted = completedLessons.filter(l => l.categoryId === 'openings').length
    if (openingsCompleted >= 8 && !userProgress.achievements.includes('opening_scholar')) {
      newAchievements.push('opening_scholar')
    }

    // Consistency
    if (userProgress.streak >= 7 && !userProgress.achievements.includes('consistency')) {
      newAchievements.push('consistency')
    }

    // Speed demon (5 lessons in one day)
    const today = new Date().toDateString()
    const todayLessons = completedLessons.filter(l => new Date(l.completedAt).toDateString() === today)
    if (todayLessons.length >= 5 && !userProgress.achievements.includes('speed_demon')) {
      newAchievements.push('speed_demon')
    }

    // Grandmaster (all categories)
    const categories = Object.keys(LESSON_CATEGORIES).filter(c => c !== 'puzzles')
    const allCategoriesCompleted = categories.every(cat => {
      const catLessons = completedLessons.filter(l => l.categoryId === cat).length
      return catLessons >= 5
    })
    if (allCategoriesCompleted && !userProgress.achievements.includes('grandmaster')) {
      newAchievements.push('grandmaster')
    }

    return newAchievements
  }
}
