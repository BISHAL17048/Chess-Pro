import { getStoredApiToken } from './authToken'

function authHeaders() {
  const token = getStoredApiToken()
  if (!token) {
    return { 'Content-Type': 'application/json' }
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Tournament request failed')
  }
  return payload.data
}

export async function fetchTournaments() {
  const response = await fetch('/api/tournaments', {
    headers: authHeaders()
  })
  return parseResponse(response)
}

export async function fetchTournamentById(tournamentId) {
  const response = await fetch(`/api/tournaments/${tournamentId}`, {
    headers: authHeaders()
  })
  return parseResponse(response)
}

export async function createTournament(payload) {
  const response = await fetch('/api/tournaments', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload || {})
  })
  return parseResponse(response)
}

export async function joinTournament(tournamentId) {
  const response = await fetch(`/api/tournaments/${tournamentId}/join`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({})
  })
  return parseResponse(response)
}

export async function startTournament(tournamentId) {
  const response = await fetch(`/api/tournaments/${tournamentId}/start`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({})
  })
  return parseResponse(response)
}

export async function fetchTournamentLeaderboard(tournamentId) {
  const response = await fetch(`/api/tournaments/${tournamentId}/leaderboard`, {
    headers: authHeaders()
  })
  return parseResponse(response)
}
