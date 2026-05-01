import express from 'express'
import WatchController from './WatchController.js'

const router = express.Router()

// GET /api/watch/broadcasts
router.get('/broadcasts', WatchController.getActiveBroadcasts)

// GET /api/watch/broadcasts/:broadcastId
router.get('/broadcasts/:broadcastId', WatchController.getBroadcastDetails)

export default router
