import express from 'express'
import { AuthController } from '../controllers/authController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/signup', AuthController.signup)
router.post('/login', AuthController.login)
router.post('/google', AuthController.google)
router.get('/me', requireAuth, AuthController.me)
router.patch('/me/username', requireAuth, AuthController.updateUsername)

export default router
