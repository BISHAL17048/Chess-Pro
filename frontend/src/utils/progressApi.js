import { getStoredApiToken } from './authToken'

async function parseResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Progress request failed')
  }
  return data.data
}

function authHeaders() {
  const token = getStoredApiToken()
  if (!token) return { 'Content-Type': 'application/json' }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }
}

async function safePost(path, body) {
  const token = getStoredApiToken()
  if (!token) return null

  const res = await fetch(path, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body || {})
  })
  return parseResponse(res)
}

export async function fetchProgressOverview() {
  const token = getStoredApiToken()
  if (!token) return null

  const res = await fetch('/api/progress/overview', {
    headers: authHeaders()
  })
  return parseResponse(res)
}

export async function recordLearnSession(payload) {
  return safePost('/api/progress/learn/session', payload)
}

export async function recordLearnProfile(payload) {
  return safePost('/api/progress/learn/profile', payload)
}

export async function recordPuzzleAttempt(payload) {
  return safePost('/api/progress/puzzles/attempt', payload)
}

export async function recordPlayPreset(payload) {
  return safePost('/api/progress/play/preset', payload)
}

export async function recordWatchView(payload) {
  return safePost('/api/progress/watch/view', payload)
}
