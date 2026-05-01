function parseNdjson(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function normalizeResultToken(value) {
  return String(value || '')
    .replace(/Â/g, '')
    .replace(/½/g, '1/2')
    .trim()
}

function winnerFromStatus(status) {
  const token = normalizeResultToken(status)
  if (token === '1-0') return 'white'
  if (token === '0-1') return 'black'
  return null
}

async function fetchLichess(url, accept = 'application/json') {
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      'User-Agent': 'ChessPro/1.0 (watch socket)'
    }
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Lichess request failed (${response.status}): ${text.slice(0, 120)}`)
  }

  return response
}

async function loadBroadcastRound(roundId) {
  const response = await fetchLichess(`https://lichess.org/api/broadcast/-/-/${encodeURIComponent(roundId)}`)
  const data = await response.json()
  const photos = data?.photos || {}

  const games = Array.isArray(data?.games)
    ? data.games.map((game) => ({
        id: game.id,
        roundId,
        url: `https://lichess.org/broadcast/-/-/${encodeURIComponent(roundId)}/${encodeURIComponent(game.id || '')}`,
        name: game.name || null,
        fen: game.fen || null,
        white: game.players?.[0]?.name || 'White',
        black: game.players?.[1]?.name || 'Black',
        whiteTitle: game.players?.[0]?.title || null,
        blackTitle: game.players?.[1]?.title || null,
        whiteFed: game.players?.[0]?.fed || null,
        blackFed: game.players?.[1]?.fed || null,
        whiteFideId: game.players?.[0]?.fideId || null,
        blackFideId: game.players?.[1]?.fideId || null,
        whiteRating: game.players?.[0]?.rating || null,
        blackRating: game.players?.[1]?.rating || null,
        whiteClock: game.players?.[0]?.clock || null,
        blackClock: game.players?.[1]?.clock || null,
        whitePhoto: photos[String(game.players?.[0]?.fideId)]?.medium || photos[String(game.players?.[0]?.fideId)]?.small || null,
        blackPhoto: photos[String(game.players?.[1]?.fideId)]?.medium || photos[String(game.players?.[1]?.fideId)]?.small || null,
        status: game.status || null,
        winner: winnerFromStatus(game.status),
        ongoing: game.status === '*',
        lastMove: game.lastMove || null,
        thinkTime: game.thinkTime || null,
        opening: data?.tour?.name || 'Broadcast'
      }))
    : []

  return {
    sourceType: 'broadcast-round',
    sourceId: roundId,
    fetchedAt: Date.now(),
    meta: {
      round: data?.round || null,
      tour: data?.tour || null
    },
    games
  }
}

async function loadTournamentGames(tournamentId) {
  const max = 12
  const response = await fetchLichess(
    `https://lichess.org/api/tournament/${encodeURIComponent(tournamentId)}/games?max=${max}&moves=true&pgnInJson=true&opening=true&clocks=false&evals=false`,
    'application/x-ndjson'
  )

  const ndjson = await response.text()
  const rows = parseNdjson(ndjson)
  const games = rows.map((g) => ({
    id: g.id,
    status: g.status || null,
    winner: g.winner || null,
    ongoing: (g.status === 'started' || g.status === 'created') && !g.winner,
    moves: g.moves || '',
    initialFen: g.initialFen || null,
    opening: g.opening?.name || 'Unknown opening',
    white: g.players?.white?.user?.name || g.players?.white?.name || 'White',
    black: g.players?.black?.user?.name || g.players?.black?.name || 'Black',
    pgn: g.pgn || ''
  }))

  return {
    sourceType: 'tournament',
    sourceId: tournamentId,
    fetchedAt: Date.now(),
    meta: {
      tournamentId
    },
    games
  }
}

function buildStreamKey(sourceType, sourceId) {
  return `${sourceType}:${sourceId}`
}

function buildRoomName(sourceType, sourceId) {
  return `watch:${sourceType}:${sourceId}`
}

export function registerWatchSocketHandlers(io) {
  const streams = new Map()

  const getPollMs = (sourceType) => (sourceType === 'broadcast-round' ? 2000 : 3000)

  const fetchStreamPayload = async (sourceType, sourceId) => {
    if (sourceType === 'broadcast-round') {
      return loadBroadcastRound(sourceId)
    }
    if (sourceType === 'tournament') {
      return loadTournamentGames(sourceId)
    }
    throw new Error('Unsupported sourceType')
  }

  const stopStreamIfUnused = (streamKey) => {
    const stream = streams.get(streamKey)
    if (!stream) return
    if (stream.sockets.size > 0) return

    clearInterval(stream.intervalId)
    streams.delete(streamKey)
  }

  const startStream = async (sourceType, sourceId) => {
    const streamKey = buildStreamKey(sourceType, sourceId)
    const room = buildRoomName(sourceType, sourceId)
    const existing = streams.get(streamKey)
    if (existing) return existing

    const stream = {
      sourceType,
      sourceId,
      room,
      sockets: new Set(),
      intervalId: null
    }

    const poll = async () => {
      try {
        const payload = await fetchStreamPayload(sourceType, sourceId)
        io.to(room).emit('watch:games-update', payload)
      } catch (error) {
        io.to(room).emit('watch:error', {
          sourceType,
          sourceId,
          message: error?.message || 'Failed to load watch stream'
        })
      }
    }

    stream.intervalId = setInterval(poll, getPollMs(sourceType))
    streams.set(streamKey, stream)

    // Push an immediate snapshot as soon as someone subscribes.
    await poll()
    return stream
  }

  io.on('connection', (socket) => {
    socket.data.watchSubscriptions = new Set()

    socket.on('watch:subscribe', async (data = {}) => {
      const sourceType = String(data.sourceType || '').trim()
      const sourceId = String(data.sourceId || '').trim()

      if (!sourceType || !sourceId) {
        socket.emit('watch:error', {
          sourceType,
          sourceId,
          message: 'sourceType and sourceId are required'
        })
        return
      }

      if (sourceType !== 'broadcast-round' && sourceType !== 'tournament') {
        socket.emit('watch:error', {
          sourceType,
          sourceId,
          message: 'Unsupported watch source type'
        })
        return
      }

      const streamKey = buildStreamKey(sourceType, sourceId)
      const room = buildRoomName(sourceType, sourceId)
      const stream = await startStream(sourceType, sourceId)

      socket.join(room)
      stream.sockets.add(socket.id)
      socket.data.watchSubscriptions.add(streamKey)

      socket.emit('watch:subscribed', { sourceType, sourceId })
    })

    socket.on('watch:unsubscribe', (data = {}) => {
      const sourceType = String(data.sourceType || '').trim()
      const sourceId = String(data.sourceId || '').trim()
      const streamKey = buildStreamKey(sourceType, sourceId)
      const room = buildRoomName(sourceType, sourceId)

      socket.leave(room)
      socket.data.watchSubscriptions.delete(streamKey)

      const stream = streams.get(streamKey)
      if (!stream) return

      stream.sockets.delete(socket.id)
      stopStreamIfUnused(streamKey)
    })

    socket.on('disconnect', () => {
      const keys = socket.data.watchSubscriptions || new Set()

      for (const streamKey of keys) {
        const stream = streams.get(streamKey)
        if (!stream) continue

        stream.sockets.delete(socket.id)
        stopStreamIfUnused(streamKey)
      }
    })
  })
}
