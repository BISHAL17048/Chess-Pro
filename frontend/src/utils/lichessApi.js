async function parseResponse(res) {
  const data = await res.json()
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Request failed')
  }
  return data.data
}

export async function fetchLichessUserGames(username, max = 10) {
  const res = await fetch(`/api/lichess/games/user/${encodeURIComponent(username)}?max=${max}`)
  return parseResponse(res)
}

export async function fetchLichessDailyPuzzle() {
  const res = await fetch('/api/lichess/puzzle/daily')
  return parseResponse(res)
}

export async function fetchLichessNextPuzzle({ angle = 'mix', difficulty = 'normal', color = '' } = {}) {
  const params = new URLSearchParams({
    angle: String(angle || 'mix'),
    difficulty: String(difficulty || 'normal')
  })

  if (color) {
    params.set('color', String(color))
  }

  const res = await fetch(`/api/lichess/puzzle/next?${params.toString()}`)
  return parseResponse(res)
}

export async function fetchLichessPuzzleBatch({ angle = 'mix', difficulty = 'normal', nb = 15, color = '' } = {}) {
  const params = new URLSearchParams({
    difficulty: String(difficulty || 'normal'),
    nb: String(nb || 15)
  })

  if (color) {
    params.set('color', String(color))
  }

  const res = await fetch(`/api/lichess/puzzle/batch/${encodeURIComponent(String(angle || 'mix'))}?${params.toString()}`)
  return parseResponse(res)
}

export async function fetchLichessLivePuzzles({ angle = 'mix', difficulty = 'normal', count = 20, color = '' } = {}) {
  const params = new URLSearchParams({
    angle: String(angle || 'mix'),
    difficulty: String(difficulty || 'normal'),
    count: String(count || 20)
  })

  if (color) {
    params.set('color', String(color))
  }

  const res = await fetch(`/api/lichess/puzzle/live?${params.toString()}`)
  return parseResponse(res)
}

export async function fetchLichessTournaments() {
  const res = await fetch('/api/lichess/tournaments')
  return parseResponse(res)
}

export async function fetchLichessTournamentGames(tournamentId, max = 12) {
  const res = await fetch(`/api/lichess/tournaments/${encodeURIComponent(tournamentId)}/games?max=${max}`)
  return parseResponse(res)
}

export async function fetchLichessTv(channel = 'blitz') {
  const res = await fetch(`/api/lichess/tv?channel=${encodeURIComponent(channel)}`)
  return parseResponse(res)
}

export async function fetchLichessLearn() {
  const res = await fetch('/api/lichess/learn')
  return parseResponse(res)
}

export async function fetchLichessBroadcasts(max = 15, pages = 8, query = '') {
  const params = new URLSearchParams({
    max: String(max),
    pages: String(pages)
  })
  if (query) {
    params.set('q', String(query))
  }
  const res = await fetch(`/api/lichess/broadcasts?${params.toString()}`)
  return parseResponse(res)
}

export async function fetchLichessLiveStreamers(max = 12) {
  const res = await fetch(`/api/lichess/streamers/live?max=${max}`)
  return parseResponse(res)
}

export async function fetchLichessVideos({ max = 120, pages = 3, tags = '' } = {}) {
  const params = new URLSearchParams({
    max: String(max),
    pages: String(pages)
  })

  if (tags) {
    params.set('tags', String(tags))
  }

  const res = await fetch(`/api/lichess/videos?${params.toString()}`)
  return parseResponse(res)
}

export async function fetchLichessBroadcastRound(roundId) {
  const res = await fetch(`/api/lichess/broadcasts/round/${encodeURIComponent(roundId)}`)
  return parseResponse(res)
}

export async function fetchLichessBroadcastTourByRound(roundId, pages = 160) {
  const params = new URLSearchParams({
    pages: String(pages)
  })
  const res = await fetch(`/api/lichess/broadcasts/round/${encodeURIComponent(roundId)}/tour?${params.toString()}`)
  return parseResponse(res)
}

export async function fetchLichessBroadcastGamePgn(roundId, gameId) {
  const res = await fetch(`/api/lichess/broadcasts/round/${encodeURIComponent(roundId)}/game/${encodeURIComponent(gameId)}/pgn`)
  return parseResponse(res)
}

export async function fetchLichessBroadcastRoundStreams(roundId, gameId = '') {
  const params = new URLSearchParams()
  if (gameId) {
    params.set('gameId', String(gameId))
  }
  const res = await fetch(`/api/lichess/broadcasts/round/${encodeURIComponent(roundId)}/streams${params.toString() ? `?${params.toString()}` : ''}`)
  return parseResponse(res)
}

export async function fetchLichessBroadcastRoundGameStreams(roundId, maxGames = 24) {
  const params = new URLSearchParams({
    maxGames: String(maxGames)
  })
  const res = await fetch(`/api/lichess/broadcasts/round/${encodeURIComponent(roundId)}/game-streams?${params.toString()}`)
  return parseResponse(res)
}

export async function fetchChessOpenings() {
  const res = await fetch('/api/ai/openings')
  return parseResponse(res)
}

export async function fetchLiveFideRatings(limit = 30, type = 'classical') {
  const params = new URLSearchParams({
    limit: String(limit),
    type: String(type)
  })
  const res = await fetch(`/api/ratings/fide-live?${params.toString()}`)
  return parseResponse(res)
}

export async function fetchFidePlayerDetails(slug) {
  const safeSlug = String(slug || '').trim().toLowerCase()
  const res = await fetch(`/api/ratings/fide-player/${encodeURIComponent(safeSlug)}`)
  return parseResponse(res)
}

export async function fetchFidePlayerGames(slug, { page = 1, limit = 30 } = {}) {
  const safeSlug = String(slug || '').trim().toLowerCase()
  const params = new URLSearchParams({
    page: String(page || 1),
    limit: String(limit || 30)
  })
  const res = await fetch(`/api/ratings/fide-player/${encodeURIComponent(safeSlug)}/games?${params.toString()}`)
  return parseResponse(res)
}

export async function fetchFideGameDetail(pathOrUrl) {
  const params = new URLSearchParams({
    path: String(pathOrUrl || '')
  })
  const res = await fetch(`/api/ratings/fide-game?${params.toString()}`)
  return parseResponse(res)
}
