import mongoose from 'mongoose'

const tournamentParticipantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    },
    username: {
      type: String,
      required: true,
      trim: true
    },
    score: {
      type: Number,
      default: 0
    },
    games: {
      type: Number,
      default: 0
    },
    wins: {
      type: Number,
      default: 0
    },
    draws: {
      type: Number,
      default: 0
    },
    losses: {
      type: Number,
      default: 0
    },
    activeGameId: {
      type: String,
      default: null
    },
    lastPairedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
)

const tournamentGameSchema = new mongoose.Schema(
  {
    gameId: {
      type: String,
      required: true
    },
    whiteUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    },
    blackUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    },
    result: {
      type: String,
      default: null
    },
    settled: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    endedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
)

const tournamentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 80
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed'],
      default: 'scheduled'
    },
    arena: {
      durationMinutes: {
        type: Number,
        default: 30,
        min: 5,
        max: 240
      },
      startAt: {
        type: Date,
        default: null
      },
      endAt: {
        type: Date,
        default: null
      }
    },
    timeControl: {
      preset: {
        type: String,
        default: '3+2'
      },
      category: {
        type: String,
        default: 'blitz'
      },
      baseTimeMs: {
        type: Number,
        default: 180000
      },
      incrementMs: {
        type: Number,
        default: 2000
      }
    },
    participants: {
      type: [tournamentParticipantSchema],
      default: []
    },
    games: {
      type: [tournamentGameSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
)

tournamentSchema.index({ status: 1, 'arena.endAt': 1 })

const Tournament = mongoose.model('Tournament', tournamentSchema)

export default Tournament
