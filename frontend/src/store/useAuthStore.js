import { create } from 'zustand'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { firebaseAuth, googleProvider } from '../utils/firebase'
import { clearStoredApiToken, getStoredApiToken, setStoredApiToken } from '../utils/authToken'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const USERNAME_BY_EMAIL_STORAGE_KEY = 'chess.username.byEmail'

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

  return `u_${sanitized || 'user'}`.slice(0, 30)
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function readUsernameByEmailMap() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(USERNAME_BY_EMAIL_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function writeUsernameByEmailMap(map) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(USERNAME_BY_EMAIL_STORAGE_KEY, JSON.stringify(map || {}))
  } catch {
    // Ignore storage write failures.
  }
}

function getCachedUsernameForEmail(email) {
  const key = normalizeEmail(email)
  if (!key) return ''
  const map = readUsernameByEmailMap()
  return String(map[key] || '').trim()
}

function setCachedUsernameForEmail(email, username) {
  const key = normalizeEmail(email)
  const value = String(username || '').trim()
  if (!key || !value) return
  const map = readUsernameByEmailMap()
  map[key] = value
  writeUsernameByEmailMap(map)
}

export const useAuthStore = create((set, get) => ({
  user: null,
  firebaseToken: '',
  apiToken: '',
  loading: true,
  error: '',

  clearError: () => set({ error: '' }),

  initializeAuth: () => {
    set({ loading: true })

    const safetyTimeout = setTimeout(() => {
      set((state) => (state.loading ? { loading: false } : state))
    }, 5000)

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      try {
        if (!user) {
          set({ user: null, firebaseToken: '', apiToken: '', loading: false })
          return
        }

        let firebaseToken = ''
        try {
          firebaseToken = await user.getIdToken()
        } catch {
          // Continue without Firebase token so the app can still render.
        }

        const cachedApiToken = getStoredApiToken()
        let resolvedApiToken = cachedApiToken
        let backendUserId = null
        let backendEmail = normalizeEmail(user.email)
        const cachedUsername = getCachedUsernameForEmail(user.email)
        const currentStateUser = get().user
        const sameEmailCurrentUsername = normalizeEmail(currentStateUser?.email) === normalizeEmail(user.email)
          ? String(currentStateUser?.username || '').trim()
          : ''
        let backendUsername = cachedUsername || sameEmailCurrentUsername || deriveUsernameFromEmail(user.email) || 'player'

        if (cachedApiToken) {
          try {
            const meResponse = await fetch(`${API_BASE}/auth/me`, {
              headers: {
                Authorization: `Bearer ${cachedApiToken}`
              }
            })
            const mePayload = await meResponse.json()
            const meEmail = normalizeEmail(mePayload?.data?.email)
            if (meResponse.ok && mePayload?.success && mePayload?.data?.username && meEmail === normalizeEmail(user.email)) {
              backendUserId = mePayload.data.id || null
              backendUsername = mePayload.data.username
              backendEmail = mePayload.data.email || backendEmail
              setCachedUsernameForEmail(user.email, backendUsername)
            } else {
              clearStoredApiToken()
              resolvedApiToken = ''
            }
          } catch {
            clearStoredApiToken()
            resolvedApiToken = ''
          }
        }

        if (!backendUserId && user.email && user.uid) {
          try {
            const response = await fetch(`${API_BASE}/auth/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: user.email,
                firebaseUid: user.uid
              })
            })

            const payload = await response.json()
            const payloadEmail = normalizeEmail(payload?.data?.user?.email)
            if (response.ok && payload?.success && payload?.data?.token && payload?.data?.user && payloadEmail === normalizeEmail(user.email)) {
              resolvedApiToken = payload.data.token
              setStoredApiToken(resolvedApiToken)
              backendUserId = payload.data.user.id || null
              backendUsername = payload.data.user.username || backendUsername
              backendEmail = payload.data.user.email || backendEmail
              setCachedUsernameForEmail(user.email, backendUsername)
            } else {
              clearStoredApiToken()
              resolvedApiToken = ''
            }
          } catch {
            // Continue with deterministic username fallback when backend re-hydration fails.
          }
        }

        // Never replace an existing explicit username with an email-derived fallback.
        if (sameEmailCurrentUsername && backendUsername === deriveUsernameFromEmail(user.email)) {
          backendUsername = sameEmailCurrentUsername
        }

        setCachedUsernameForEmail(user.email, backendUsername)

        set({
          user: {
            id: backendUserId,
            uid: user.uid,
            email: backendEmail || user.email,
            username: backendUsername,
            displayName: backendUsername || user.displayName || user.email
          },
          firebaseToken,
          apiToken: resolvedApiToken,
          loading: false,
          error: ''
        })
      } catch {
        set({ loading: false, error: 'Failed to initialize authentication' })
      } finally {
        clearTimeout(safetyTimeout)
      }
    })

    return () => {
      clearTimeout(safetyTimeout)
      unsubscribe()
    }
  },

  signup: async ({ username, email, password }) => {
    set({ loading: true, error: '' })
    try {
      const credentials = await createUserWithEmailAndPassword(firebaseAuth, email, password)
      const firebaseToken = await credentials.user.getIdToken()

      const requestedUsername = String(username || '').trim()

      const response = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username: requestedUsername || undefined })
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Backend signup failed')
      }

      setStoredApiToken(payload.data.token)
      const resolvedUsername = payload.data.user.username || requestedUsername || getCachedUsernameForEmail(credentials.user.email) || deriveUsernameFromEmail(credentials.user.email)
      setCachedUsernameForEmail(credentials.user.email, resolvedUsername)

      set({
        user: {
          id: payload.data.user.id,
          uid: credentials.user.uid,
          email: credentials.user.email,
          username: resolvedUsername,
          displayName: resolvedUsername
        },
        firebaseToken,
        apiToken: payload.data.token,
        loading: false,
        error: ''
      })
    } catch (error) {
      set({ loading: false, error: error.message })
    }
  },

  login: async ({ email, password }) => {
    set({ loading: true, error: '' })
    try {
      const credentials = await signInWithEmailAndPassword(firebaseAuth, email, password)
      const firebaseToken = await credentials.user.getIdToken()

      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Backend login failed')
      }

      setStoredApiToken(payload.data.token)
      const resolvedUsername = payload.data.user.username || getCachedUsernameForEmail(credentials.user.email) || deriveUsernameFromEmail(credentials.user.email)
      setCachedUsernameForEmail(credentials.user.email, resolvedUsername)

      set({
        user: {
          id: payload.data.user.id,
          uid: credentials.user.uid,
          email: credentials.user.email,
          username: resolvedUsername,
          displayName: resolvedUsername
        },
        firebaseToken,
        apiToken: payload.data.token,
        loading: false,
        error: ''
      })
    } catch (error) {
      set({ loading: false, error: error.message })
    }
  },

  loginWithGoogle: async () => {
    set({ loading: true, error: '' })
    try {
      const credentials = await signInWithPopup(firebaseAuth, googleProvider)
      const firebaseToken = await credentials.user.getIdToken()

      const response = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: credentials.user.email,
          firebaseUid: credentials.user.uid
        })
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Google auth failed')
      }

      setStoredApiToken(payload.data.token)
      const resolvedUsername = payload.data.user.username || getCachedUsernameForEmail(credentials.user.email) || deriveUsernameFromEmail(credentials.user.email)
      setCachedUsernameForEmail(credentials.user.email, resolvedUsername)

      set({
        user: {
          id: payload.data.user.id,
          uid: credentials.user.uid,
          email: credentials.user.email,
          username: resolvedUsername,
          displayName: resolvedUsername
        },
        firebaseToken,
        apiToken: payload.data.token,
        loading: false,
        error: ''
      })
    } catch (error) {
      set({ loading: false, error: error.message })
    }
  },

  logout: async () => {
    await signOut(firebaseAuth)
    clearStoredApiToken()
    set({ user: null, firebaseToken: '', apiToken: '', error: '' })
  },

  updateUsername: async (username) => {
    const apiToken = get().apiToken || getStoredApiToken()
    const currentUser = get().user

    if (!apiToken) {
      throw new Error('You are not logged in')
    }

    const requested = String(username || '').trim()
    if (requested.length < 3) {
      throw new Error('Username must be at least 3 characters')
    }

    set({ error: '' })

    const response = await fetch(`${API_BASE}/auth/me/username`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`
      },
      body: JSON.stringify({ username: requested })
    })

    const payload = await response.json()
    if (!response.ok || !payload?.success || !payload?.data?.user) {
      throw new Error(payload?.error || 'Failed to update username')
    }

    const nextToken = payload?.data?.token || apiToken
    setStoredApiToken(nextToken)
    setCachedUsernameForEmail(payload.data.user.email || currentUser?.email, payload.data.user.username)

    set({
      apiToken: nextToken,
      user: {
        ...(currentUser || {}),
        id: payload.data.user.id || currentUser?.id || null,
        email: payload.data.user.email || currentUser?.email || null,
        username: payload.data.user.username,
        displayName: payload.data.user.username
      }
    })

    return payload.data.user
  }
}))
