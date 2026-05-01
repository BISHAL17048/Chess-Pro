import mongoose from 'mongoose'

const userProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    learn: {
      botGamesPlayed: { type: Number, default: 0 },
      botGamesWon: { type: Number, default: 0 },
      lastBotId: { type: String, default: 'nelson' },
      streakDays: { type: Number, default: 0 },
      totalStudyMinutes: { type: Number, default: 0 }
    },
    puzzles: {
      solved: { type: Number, default: 0 },
      mistakes: { type: Number, default: 0 },
      bestStreak: { type: Number, default: 0 },
      currentStreak: { type: Number, default: 0 },
      lastTheme: { type: String, default: 'mix' }
    },
    play: {
      gamesPlayed: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
      favoriteTimeControl: { type: String, default: '5+0' }
    },
    watch: {
      gamesWatched: { type: Number, default: 0 },
      lastSource: { type: String, default: 'tournament' }
    }
  },
  {
    timestamps: true
  }
)

const UserProgress = mongoose.model('UserProgress', userProgressSchema)

export default UserProgress
