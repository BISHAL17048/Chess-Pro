import Tournament from '../models/Tournament.js'
import GameService from './GameService.js'

class TournamentService {
  constructor() {
    this.tickInterval = null
  }

  startScheduler() {
    if (this.tickInterval) return
    this.tickInterval = setInterval(() => {
      Promise.resolve(this.tick()).catch(() => {})
    }, 5000)
  }

  stopScheduler() {
    if (!this.tickInterval) return
    clearInterval(this.tickInterval)
    this.tickInterval = null
  }

  async createTournament({ name, createdBy, timeControl, durationMinutes }) {
    const safeDuration = Math.max(5, Math.min(240, Number(durationMinutes || 30)))
    const tournament = await Tournament.create({
      name,
      createdBy,
      arena: {
        durationMinutes: safeDuration,
        startAt: null,
        endAt: null
      },
      timeControl: {
        preset: String(timeControl?.preset || '3+2'),
        category: String(timeControl?.category || 'blitz'),
        baseTimeMs: Number(timeControl?.baseTimeMs || 180000),
        incrementMs: Number(timeControl?.incrementMs || 2000)
      }
    })

    return tournament
  }

  async listTournaments() {
    return Tournament.find({}).sort({ createdAt: -1 }).limit(30).lean()
  }

  async getTournamentById(id) {
    return Tournament.findById(id).lean()
  }

  async joinTournament({ tournamentId, userId, username }) {
    const tournament = await Tournament.findById(tournamentId)
    if (!tournament) {
      return { success: false, error: 'Tournament not found' }
    }

    if (tournament.status === 'completed') {
      return { success: false, error: 'Tournament already completed' }
    }

    const existing = tournament.participants.find((p) => String(p.userId) === String(userId))
    if (existing) {
      return { success: true, tournament }
    }

    tournament.participants.push({
      userId,
      username,
      score: 0,
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      activeGameId: null,
      lastPairedAt: null
    })

    await tournament.save()
    return { success: true, tournament }
  }

  async startTournament({ tournamentId, requesterId }) {
    const tournament = await Tournament.findById(tournamentId)
    if (!tournament) {
      return { success: false, error: 'Tournament not found' }
    }

    if (String(tournament.createdBy) !== String(requesterId)) {
      return { success: false, error: 'Only creator can start tournament' }
    }

    if (tournament.status !== 'scheduled') {
      return { success: false, error: 'Tournament already started' }
    }

    const now = new Date()
    tournament.status = 'active'
    tournament.arena.startAt = now
    tournament.arena.endAt = new Date(now.getTime() + tournament.arena.durationMinutes * 60000)
    await tournament.save()

    return { success: true, tournament }
  }

  buildLeaderboard(tournament) {
    const rows = [...(tournament?.participants || [])]
    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.wins !== a.wins) return b.wins - a.wins
      return a.games - b.games
    })

    return rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      username: row.username,
      score: row.score,
      games: row.games,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      activeGameId: row.activeGameId || null
    }))
  }

  resolveArenaResult(result) {
    if (result === 'white-win' || result === 'black-timeout') return { white: 2, black: 0, winner: 'white' }
    if (result === 'black-win' || result === 'white-timeout') return { white: 0, black: 2, winner: 'black' }
    if (result === 'draw' || result === 'stalemate') return { white: 1, black: 1, winner: null }
    return { white: 0, black: 0, winner: null }
  }

  canPairParticipant(participant) {
    if (!participant) return false
    if (participant.activeGameId) {
      const gameState = GameService.getGameState(String(participant.activeGameId))
      if (gameState && gameState.status !== 'completed') {
        return false
      }
    }
    return true
  }

  async settleTournamentGames(tournament) {
    let changed = false

    for (const gameRow of tournament.games) {
      if (gameRow.settled) continue
      const gameState = GameService.getGameState(gameRow.gameId)
      if (!gameState || gameState.status !== 'completed') continue

      const score = this.resolveArenaResult(gameState.result)
      const white = tournament.participants.find((p) => String(p.userId) === String(gameRow.whiteUserId))
      const black = tournament.participants.find((p) => String(p.userId) === String(gameRow.blackUserId))
      if (!white || !black) continue

      white.score += score.white
      black.score += score.black
      white.games += 1
      black.games += 1
      white.activeGameId = null
      black.activeGameId = null

      if (score.winner === 'white') {
        white.wins += 1
        black.losses += 1
      } else if (score.winner === 'black') {
        black.wins += 1
        white.losses += 1
      } else {
        white.draws += 1
        black.draws += 1
      }

      gameRow.result = gameState.result
      gameRow.settled = true
      gameRow.endedAt = new Date()
      changed = true
    }

    return changed
  }

  choosePairingCandidates(tournament) {
    const available = tournament.participants.filter((p) => this.canPairParticipant(p))
    available.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (new Date(a.lastPairedAt || 0)).getTime() - (new Date(b.lastPairedAt || 0)).getTime()
    })

    const pairs = []
    while (available.length >= 2) {
      const a = available.shift()
      const b = available.shift()
      pairs.push([a, b])
    }

    return pairs
  }

  async pairTournament(tournament) {
    const pairs = this.choosePairingCandidates(tournament)
    if (!pairs.length) return false

    let changed = false
    for (const [a, b] of pairs) {
      const host = Math.random() < 0.5 ? a : b
      const guest = host === a ? b : a

      const created = GameService.createGame(String(host.userId), {
        username: host.username,
        gameMode: 'tournament',
        variant: 'standard',
        rated: false,
        tournamentId: String(tournament._id),
        timeControl: {
          preset: tournament.timeControl.preset,
          category: tournament.timeControl.category,
          baseTimeMs: tournament.timeControl.baseTimeMs,
          incrementMs: tournament.timeControl.incrementMs
        },
        rating: 1200
      })

      const joined = GameService.joinGame(created.gameId, String(guest.userId), guest.username, 1200)
      if (!joined?.success) {
        continue
      }

      host.activeGameId = created.gameId
      guest.activeGameId = created.gameId
      host.lastPairedAt = new Date()
      guest.lastPairedAt = new Date()

      tournament.games.push({
        gameId: created.gameId,
        whiteUserId: created.players.white.id,
        blackUserId: joined.playerId,
        result: null,
        settled: false,
        createdAt: new Date(),
        endedAt: null
      })
      changed = true
    }

    return changed
  }

  async tick() {
    const tournaments = await Tournament.find({ status: 'active' })
    if (!tournaments.length) return

    for (const tournament of tournaments) {
      let changed = false
      changed = (await this.settleTournamentGames(tournament)) || changed

      const now = Date.now()
      const endAtMs = new Date(tournament.arena.endAt || 0).getTime()
      if (endAtMs > 0 && now >= endAtMs) {
        tournament.status = 'completed'
        changed = true
      } else {
        changed = (await this.pairTournament(tournament)) || changed
      }

      if (changed) {
        await tournament.save()
      }
    }
  }
}

export default new TournamentService()
