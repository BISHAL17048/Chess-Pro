import TournamentService from '../services/TournamentService.js'
import User from '../models/User.js'

class TournamentController {
  static async create(req, res) {
    try {
      const { name, timeControl, durationMinutes } = req.body || {}
      if (!name) {
        return res.status(400).json({ success: false, error: 'name is required' })
      }

      const tournament = await TournamentService.createTournament({
        name,
        createdBy: req.auth.sub,
        timeControl,
        durationMinutes
      })

      return res.status(201).json({ success: true, data: tournament })
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  static async list(req, res) {
    try {
      const tournaments = await TournamentService.listTournaments()
      return res.status(200).json({ success: true, data: tournaments })
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getById(req, res) {
    try {
      const tournament = await TournamentService.getTournamentById(req.params.id)
      if (!tournament) {
        return res.status(404).json({ success: false, error: 'Tournament not found' })
      }
      return res.status(200).json({ success: true, data: tournament })
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  static async join(req, res) {
    try {
      const user = await User.findById(req.auth.sub).select('_id username')
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }

      const result = await TournamentService.joinTournament({
        tournamentId: req.params.id,
        userId: user._id,
        username: user.username
      })

      if (!result.success) {
        return res.status(400).json(result)
      }

      return res.status(200).json({ success: true, data: result.tournament })
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  static async start(req, res) {
    try {
      const result = await TournamentService.startTournament({
        tournamentId: req.params.id,
        requesterId: req.auth.sub
      })

      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error })
      }

      return res.status(200).json({ success: true, data: result.tournament })
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  static async leaderboard(req, res) {
    try {
      const tournament = await TournamentService.getTournamentById(req.params.id)
      if (!tournament) {
        return res.status(404).json({ success: false, error: 'Tournament not found' })
      }

      const leaderboard = TournamentService.buildLeaderboard(tournament)
      return res.status(200).json({ success: true, data: leaderboard })
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message })
    }
  }
}

export default TournamentController
