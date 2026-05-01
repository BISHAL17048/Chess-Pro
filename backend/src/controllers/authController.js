import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import GameRecord from '../models/GameRecord.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

function deriveUsernameFromEmail(email) {
  const localPart = String(email || '').split('@')[0] || ''
  const sanitized = localPart
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[_\-.]+|[_\-.]+$/g, '')

  if (sanitized.length >= 3) {
    return sanitized.slice(0, 30)
  }

  const fallback = `u_${sanitized || 'user'}`
  return fallback.slice(0, 30)
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      username: user.username,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

function normalizeUsernameInput(username) {
  const raw = String(username || '').trim().toLowerCase()
  const sanitized = raw
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[_\-.]+|[_\-.]+$/g, '')

  return sanitized.slice(0, 30)
}

export class AuthController {
  static async signup(req, res) {
    try {
      const { email, password } = req.body
      const requestedUsername = normalizeUsernameInput(req.body?.username)

      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'email and password are required' })
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
      }

      const normalizedEmail = String(email || '').toLowerCase().trim()
      const derivedUsername = requestedUsername || deriveUsernameFromEmail(normalizedEmail)

      const existingByEmail = await User.findOne({ email: normalizedEmail })
      if (existingByEmail) {
        return res.status(409).json({ success: false, error: 'User with this email already exists' })
      }

      const existingByUsername = await User.findOne({ username: derivedUsername })
      if (existingByUsername) {
        return res.status(409).json({ success: false, error: requestedUsername ? 'Username is already taken' : 'Username derived from email is already taken. Use a different email.' })
      }

      const passwordHash = await bcrypt.hash(password, 12)
      const user = await User.create({
        username: derivedUsername,
        email: normalizedEmail,
        passwordHash,
        ratings: {
          bullet: 100,
          blitz: 100,
          rapid: 100,
          classical: 100
        }
      })
      const token = signToken(user)

      return res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email
          }
        }
      })
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body

      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'email and password are required' })
      }

      const normalizedEmail = String(email || '').toLowerCase().trim()
      const user = await User.findOne({ email: normalizedEmail })
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' })
      }

      if (!user.passwordHash) {
        return res.status(401).json({ success: false, error: 'Use Google sign in for this account' })
      }

      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' })
      }

      const token = signToken(user)

      return res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email
          }
        }
      })
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  static async google(req, res) {
    try {
      const { email, firebaseUid } = req.body

      if (!email || !firebaseUid) {
        return res.status(400).json({ success: false, error: 'email and firebaseUid are required' })
      }

      const normalizedEmail = String(email || '').toLowerCase().trim()
      const derivedUsername = deriveUsernameFromEmail(normalizedEmail)

      let user = await User.findOne({ email: normalizedEmail })

      if (!user) {
        const existingByUsername = await User.findOne({ username: derivedUsername })
        if (existingByUsername) {
          return res.status(409).json({ success: false, error: 'Username derived from email is already taken. Use a different email.' })
        }

        user = await User.create({
          username: derivedUsername,
          email: normalizedEmail,
          authProvider: 'google',
          firebaseUid,
          passwordHash: null,
          ratings: {
            bullet: 100,
            blitz: 100,
            rapid: 100,
            classical: 100
          }
        })
      } else {
        // Username is immutable once account is created.
        if (!user.firebaseUid) {
          user.firebaseUid = firebaseUid
        }
        await user.save()
      }

      const token = signToken(user)

      return res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email
          }
        }
      })
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  static async me(req, res) {
    try {
      const user = await User.findById(req.auth.sub).select('_id username email createdAt ratings gamesPlayed')
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }

      return res.status(200).json({
        success: true,
        data: {
          id: user._id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
          ratings: user.ratings,
          gamesPlayed: user.gamesPlayed
        }
      })
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  static async updateUsername(req, res) {
    try {
      const userId = String(req.auth?.sub || '').trim()
      const requestedUsername = normalizeUsernameInput(req.body?.username)

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' })
      }

      if (!requestedUsername || requestedUsername.length < 3) {
        return res.status(400).json({ success: false, error: 'Username must be at least 3 characters' })
      }

      const existing = await User.findOne({ username: requestedUsername })
      if (existing && String(existing._id) !== userId) {
        return res.status(409).json({ success: false, error: 'Username is already taken' })
      }

      const user = await User.findById(userId)
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }

      if (user.username === requestedUsername) {
        const token = signToken(user)
        return res.status(200).json({
          success: true,
          data: {
            token,
            user: {
              id: user._id,
              username: user.username,
              email: user.email,
              createdAt: user.createdAt,
              ratings: user.ratings,
              gamesPlayed: user.gamesPlayed
            }
          }
        })
      }

      user.username = requestedUsername
      await user.save()

      const normalizedEmail = String(user.email || '').trim().toLowerCase()
      if (normalizedEmail) {
        await Promise.all([
          GameRecord.updateMany(
            { 'whitePlayer.email': normalizedEmail },
            { $set: { 'whitePlayer.username': requestedUsername } }
          ),
          GameRecord.updateMany(
            { 'blackPlayer.email': normalizedEmail },
            { $set: { 'blackPlayer.username': requestedUsername } }
          )
        ])
      }

      const token = signToken(user)

      return res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            ratings: user.ratings,
            gamesPlayed: user.gamesPlayed
          }
        }
      })
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message || 'Failed to update username' })
    }
  }
}
