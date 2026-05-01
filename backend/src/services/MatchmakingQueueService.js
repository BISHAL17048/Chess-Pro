import { createClient } from 'redis'

const MATCH_QUEUE_PREFIX = 'mmq:v1'

class MatchmakingQueueService {
  constructor() {
    this.client = null
    this.isReady = false
    this.memoryQueues = new Map()
    this.memoryMembers = new Map()
  }

  async init() {
    const redisUrl = process.env.REDIS_URL || ''
    if (!redisUrl) return

    try {
      const client = createClient({ url: redisUrl })
      client.on('error', () => {
        this.isReady = false
      })
      await client.connect()
      this.client = client
      this.isReady = true
    } catch {
      this.client = null
      this.isReady = false
    }
  }

  queueKey({ mode, preset, variant }) {
    const safeMode = String(mode || 'casual').toLowerCase()
    const safePreset = String(preset || '5+0').toLowerCase()
    const safeVariant = String(variant || 'standard').toLowerCase()
    return `${MATCH_QUEUE_PREFIX}:${safeMode}:${safePreset}:${safeVariant}`
  }

  buildMember(payload) {
    const value = {
      gameId: String(payload.gameId),
      hostPlayerId: String(payload.hostPlayerId),
      hostRating: Number(payload.hostRating || 1200),
      hostOpenSeatColor: String(payload.hostOpenSeatColor || 'black').toLowerCase(),
      hostColorPreference: String(payload.hostColorPreference || 'random').toLowerCase(),
      queuedAt: Number(payload.queuedAt || Date.now())
    }
    return JSON.stringify(value)
  }

  parseMember(raw) {
    try {
      return JSON.parse(String(raw || ''))
    } catch {
      return null
    }
  }

  computeRatingWindow(waitMs) {
    const safeWait = Math.max(0, Number(waitMs || 0))
    const bucket = Math.floor(safeWait / 15000)
    return Math.min(400, 100 + bucket * 100)
  }

  isColorCompatible(requesterPreference, openSeatColor) {
    const preference = String(requesterPreference || 'random').toLowerCase()
    const seat = String(openSeatColor || '').toLowerCase()
    if (preference === 'random') return true
    return preference === seat
  }

  async enqueue(payload) {
    const score = Number(payload.queuedAt || Date.now())
    const key = this.queueKey(payload)
    const member = this.buildMember(payload)

    if (this.isReady && this.client) {
      await this.client.zAdd(key, [{ score, value: member }])
      return
    }

    const queue = this.memoryQueues.get(key) || []
    queue.push({ score, value: member })
    queue.sort((a, b) => a.score - b.score)
    this.memoryQueues.set(key, queue)
    this.memoryMembers.set(`${key}:${payload.gameId}`, member)
  }

  async removeByGameId(payload) {
    const key = this.queueKey(payload)

    if (this.isReady && this.client) {
      const members = await this.client.zRange(key, 0, -1)
      for (const raw of members) {
        const parsed = this.parseMember(raw)
        if (parsed?.gameId === String(payload.gameId)) {
          await this.client.zRem(key, raw)
          break
        }
      }
      return
    }

    const queue = this.memoryQueues.get(key) || []
    const filtered = queue.filter((entry) => {
      const parsed = this.parseMember(entry.value)
      return parsed?.gameId !== String(payload.gameId)
    })
    this.memoryQueues.set(key, filtered)
    this.memoryMembers.delete(`${key}:${payload.gameId}`)
  }

  async findBestMatch(payload) {
    const key = this.queueKey(payload)
    const now = Date.now()
    const requesterRating = Number(payload.requesterRating || 1200)

    const evaluate = (raw) => {
      const parsed = this.parseMember(raw)
      if (!parsed) return null
      if (parsed.hostPlayerId === String(payload.requesterPlayerId)) return null

      const hostWaitMs = now - Number(parsed.queuedAt || now)
      const allowedDiff = Math.max(
        this.computeRatingWindow(0),
        this.computeRatingWindow(hostWaitMs)
      )
      const diff = Math.abs(Number(parsed.hostRating || 1200) - requesterRating)
      if (diff > allowedDiff) return null

      if (!this.isColorCompatible(payload.requesterColorPreference, parsed.hostOpenSeatColor)) {
        return null
      }

      return parsed
    }

    if (this.isReady && this.client) {
      const candidates = await this.client.zRange(key, 0, 99)
      for (const raw of candidates) {
        const parsed = evaluate(raw)
        if (!parsed) continue
        const removed = await this.client.zRem(key, raw)
        if (removed > 0) {
          return parsed
        }
      }
      return null
    }

    const queue = this.memoryQueues.get(key) || []
    for (let index = 0; index < queue.length; index += 1) {
      const raw = queue[index].value
      const parsed = evaluate(raw)
      if (!parsed) continue
      queue.splice(index, 1)
      this.memoryQueues.set(key, queue)
      this.memoryMembers.delete(`${key}:${parsed.gameId}`)
      return parsed
    }

    return null
  }
}

export default new MatchmakingQueueService()
