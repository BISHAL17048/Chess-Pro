import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      unique: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      match: /^\S+@\S+\.\S+$/
    },
    passwordHash: {
      type: String,
      default: null
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local'
    },
    firebaseUid: {
      type: String,
      default: null
    },
    ratings: {
      bullet: {
        type: Number,
        default: 100,
        min: 100,
        max: 4000
      },
      blitz: {
        type: Number,
        default: 100,
        min: 100,
        max: 4000
      },
      rapid: {
        type: Number,
        default: 100,
        min: 100,
        max: 4000
      },
      classical: {
        type: Number,
        default: 100,
        min: 100,
        max: 4000
      }
    },
    gamesPlayed: {
      total: {
        type: Number,
        default: 0,
        min: 0
      },
      rated: {
        type: Number,
        default: 0,
        min: 0
      },
      casual: {
        type: Number,
        default: 0,
        min: 0
      }
    }
  },
  {
    timestamps: true
  }
)

const User = mongoose.model('User', userSchema)

export default User
