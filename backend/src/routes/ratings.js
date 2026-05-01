import express from 'express'
import User from '../models/User.js'

const router = express.Router()

const RATING_SOURCES = {
  classical: {
    label: 'Classical',
    sourceUrl: 'https://2700chess.com/',
    mirrorUrl: 'https://r.jina.ai/http://2700chess.com/?per-page=100'
  },
  rapid: {
    label: 'Rapid',
    sourceUrl: 'https://2700chess.com/rapid',
    mirrorUrl: 'https://r.jina.ai/http://2700chess.com/rapid?per-page=100'
  },
  blitz: {
    label: 'Blitz',
    sourceUrl: 'https://2700chess.com/blitz',
    mirrorUrl: 'https://r.jina.ai/http://2700chess.com/blitz?per-page=100'
  }
}

const RATING_TYPES = Object.keys(RATING_SOURCES)
const CACHE_TTL_MS = 30 * 1000
const PLAYER_CACHE_TTL_MS = 5 * 60 * 1000
const PLAYER_GAMES_CACHE_TTL_MS = 60 * 1000
const GAME_DETAIL_CACHE_TTL_MS = 60 * 1000

const cacheByType = {
  classical: null,
  rapid: null,
  blitz: null
}

const cacheTimeByType = {
  classical: 0,
  rapid: 0,
  blitz: 0
}

const inFlightByType = {
  classical: null,
  rapid: null,
  blitz: null
}

const playerCacheBySlug = new Map()
const playerCacheTimeBySlug = new Map()
const playerInFlightBySlug = new Map()
const playerGamesCacheByKey = new Map()
const playerGamesCacheTimeByKey = new Map()
const playerGamesInFlightByKey = new Map()
const gameDetailCacheByPath = new Map()
const gameDetailCacheTimeByPath = new Map()
const gameDetailInFlightByPath = new Map()

router.get('/player/:username', async (req, res) => {
  try {
    const username = String(req.params.username || '').trim()
    if (!username) {
      res.status(400).json({ success: false, error: 'username is required' })
      return
    }

    const user = await User.findOne({ username })
      .select('_id username email ratings gamesPlayed createdAt')
      .lean()

    if (!user) {
      res.status(404).json({ success: false, error: 'Player not found' })
      return
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        ratings: {
          bullet: Number(user?.ratings?.bullet || 100),
          blitz: Number(user?.ratings?.blitz || 100),
          rapid: Number(user?.ratings?.rapid || 100)
        },
        gamesPlayed: user.gamesPlayed || { total: 0, rated: 0, casual: 0 },
        createdAt: user.createdAt
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch player profile' })
  }
})

function parseNameFromMarkdown(cell) {
  const match = String(cell || '').match(/\[([^\]]+)\]\([^)]*\)/)
  return (match?.[1] || String(cell || '')).trim()
}

function parseLinkFromMarkdown(cell) {
  const match = String(cell || '').match(/\[[^\]]+\]\(([^)]+)\)/)
  return (match?.[1] || '').trim()
}

function extractPlayerSlug(playerUrl) {
  const match = String(playerUrl || '').match(/\/players\/([^/?#]+)/i)
  return (match?.[1] || '').trim().toLowerCase()
}

function parseSignedNumber(cell) {
  const raw = String(cell || '')
    .replace(/[−–]/g, '-')
    .replace(/[^0-9+.-]/g, '')
    .trim()

  if (!raw || raw === '-' || raw === '+') return null
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : null
}

function parseLiveStatus(cell) {
  const raw = String(cell || '').trim()
  const lower = raw.toLowerCase()
  const isLive = lower.includes('[live]') || lower.includes('>live<')
  const urlMatch = raw.match(/\((https?:\/\/[^)]+)\)/i)
  return {
    isLive,
    liveUrl: isLive ? (urlMatch?.[1] || null) : null,
    statusRaw: raw
  }
}

function parsePlayerLinks(markdown) {
  const linkMap = {
    fide: null,
    wikipedia: null,
    facebook: null,
    twitter: null,
    instagram: null
  }

  const patterns = [
    ['fide', /\[FIDE\]\((https?:\/\/[^)]+)\)/i],
    ['wikipedia', /\[Wikipedia\]\((https?:\/\/[^)]+)\)/i],
    ['facebook', /\[Facebook\]\((https?:\/\/[^)]+)\)/i],
    ['twitter', /\[Twitter\]\((https?:\/\/[^)]+)\)/i],
    ['instagram', /\[Instagram\]\((https?:\/\/[^)]+)\)/i]
  ]

  patterns.forEach(([key, pattern]) => {
    const match = markdown.match(pattern)
    if (match?.[1]) linkMap[key] = match[1]
  })

  return linkMap
}

function parseSectionText(markdown, sectionTitle) {
  const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`\\*\\*${escaped}\\*\\*([\\s\\S]*?)(?=\\n\\*\\*[A-Z][^*]+\\*\\*|\\n#\\s*2700chess\\.com|$)`, 'i')
  const match = String(markdown || '').match(pattern)
  return (match?.[1] || '').trim() || null
}

function parseOpeningLines(block) {
  if (!block) return []
  return String(block)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /\([0-9]+\s+games\)/i.test(line))
}

function parseOpenings(markdown) {
  const body = String(markdown || '')
  const whiteBlockMatch = body.match(/\*\*White:\*\*([\s\S]*?)\*\*Black:\*\*/i)
  const blackBlockMatch = body.match(/\*\*Black:\*\*([\s\S]*?)(?:\n\*\*Championships\*\*|\n\*\s*\*\s*\*|\n#\s*2700chess\.com|$)/i)

  return {
    white: parseOpeningLines(whiteBlockMatch?.[1] || ''),
    black: parseOpeningLines(blackBlockMatch?.[1] || '')
  }
}

function parseRatingHistory(markdown) {
  const lines = String(markdown || '').split(/\r?\n/)
  const rows = []

  for (const line of lines) {
    if (!/^\|\s*[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s*\|/.test(line)) continue

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())

    if (cells.length < 2) continue

    const rating = Number.parseInt(String(cells[1]).replace(/,/g, ''), 10)
    if (!Number.isFinite(rating)) continue

    rows.push({
      date: cells[0],
      rating
    })
  }

  return rows
}

function parseResultCell(cell) {
  const raw = String(cell || '').trim()
  const textMatch = raw.match(/\[([^\]]+)\]\(([^)]+)\)/)
  const directMatch = raw.match(/^(1-0|0-1|1\/2)$/)
  if (textMatch) {
    return {
      result: textMatch[1],
      url: textMatch[2]
    }
  }
  if (directMatch) {
    return {
      result: directMatch[1],
      url: null
    }
  }
  return {
    result: raw || null,
    url: null
  }
}

function parseGamesTable(markdown) {
  const lines = String(markdown || '').split(/\r?\n/)
  const rows = []

  for (const line of lines) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())

    if (cells.length < 10) continue

    const index = Number.parseInt(cells[0], 10)
    const white = cells[1] || null
    const whiteRating = Number.parseInt(cells[2] || '', 10)
    const black = cells[3] || null
    const blackRating = Number.parseInt(cells[4] || '', 10)
    const resultCell = parseResultCell(cells[5])
    const moves = Number.parseInt(cells[6] || '', 10)
    const site = cells[7] || null
    const date = cells[8] || null
    const boardLink = parseLinkFromMarkdown(cells[9])
    const primaryLink = resultCell.url || boardLink || ''
    const gamePathMatch = String(primaryLink).match(/https?:\/\/2700chess\.com(\/games\/[^?#]+)/i)
      || String(primaryLink).match(/^(\/games\/[^?#]+)/i)
    const gamePath = gamePathMatch?.[1] || null
    const gameUrl = gamePath ? `https://2700chess.com${gamePath}` : null

    if (!Number.isFinite(index) || !white || !black || !gamePath) continue

    rows.push({
      index,
      white,
      whiteRating: Number.isFinite(whiteRating) ? whiteRating : null,
      black,
      blackRating: Number.isFinite(blackRating) ? blackRating : null,
      result: resultCell.result,
      moves: Number.isFinite(moves) ? moves : null,
      site,
      date,
      gamePath,
      gameUrl
    })
  }

  return rows
}

function normalizePage(rawPage) {
  const page = Number.parseInt(String(rawPage || '1'), 10)
  if (!Number.isFinite(page)) return 1
  return Math.max(1, page)
}

function normalizeGamesLimit(rawLimit) {
  const limit = Number.parseInt(String(rawLimit || '30'), 10)
  if (!Number.isFinite(limit)) return 30
  return Math.max(1, Math.min(100, limit))
}

function normalizeGamePath(rawValue) {
  const value = String(rawValue || '').trim()
  if (!value) return null

  if (value.startsWith('/games/')) {
    return value.split('?')[0].split('#')[0]
  }

  const fullMatch = value.match(/^https?:\/\/2700chess\.com(\/games\/[^?#]+)/i)
  if (fullMatch?.[1]) return fullMatch[1]

  return null
}

function parseGameMovetext(markdown) {
  const blockMatch = String(markdown || '').match(/Eval Bar\s*\n+([\s\S]*?)\n+\*\s+\[Add to Library\]/i)
  if (!blockMatch?.[1]) return null

  return blockMatch[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseGameTitleParts(title) {
  const raw = String(title || '').trim()
  if (!raw) {
    return {
      white: null,
      black: null,
      event: null
    }
  }

  const titleOnly = raw.replace(/\s*[-\u2013]\s*2700chess\.com\s*$/i, '').trim()
  const parts = titleOnly.split(' – ')
  if (parts.length < 2) {
    return {
      white: null,
      black: null,
      event: titleOnly
    }
  }

  const white = parts[0].trim()
  const right = parts.slice(1).join(' – ').trim()
  const commaIdx = right.indexOf(',')
  if (commaIdx === -1) {
    return {
      white,
      black: right,
      event: null
    }
  }

  return {
    white,
    black: right.slice(0, commaIdx).trim() || null,
    event: right.slice(commaIdx + 1).trim() || null
  }
}

function normalizeResultToken(rawResult) {
  const raw = String(rawResult || '').trim()
  if (raw === '1-0' || raw === '0-1' || raw === '1/2-1/2') return raw
  if (raw === '1/2') return '1/2-1/2'
  return '*'
}

function buildPgn({ event, site, date, white, black, result, movetext }) {
  const safeResult = normalizeResultToken(result)
  const tags = [
    ['Event', event || '2700chess Game'],
    ['Site', site || '2700chess.com'],
    ['Date', date || '????.??.??'],
    ['White', white || 'White'],
    ['Black', black || 'Black'],
    ['Result', safeResult]
  ]

  const header = tags.map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join('\n')
  const mt = String(movetext || '').trim()
  const withResult = /\s(1-0|0-1|1\/2-1\/2|\*)\s*$/.test(mt) ? mt : `${mt} ${safeResult}`.trim()

  return `${header}\n\n${withResult}`
}

function extractWikipediaTitle(wikipediaUrl) {
  const raw = String(wikipediaUrl || '').trim()
  if (!raw) return null
  const match = raw.match(/wikipedia\.org\/wiki\/([^?#]+)/i)
  if (!match?.[1]) return null
  return decodeURIComponent(match[1]).trim() || null
}

async function loadWikipediaThumbnail(wikipediaUrl) {
  const title = extractWikipediaTitle(wikipediaUrl)
  if (!title) return null

  const endpoint = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`

  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ChessPro/1.0 (wikipedia thumbnail)'
    }
  })

  if (!response.ok) return null
  const data = await response.json()
  return data?.thumbnail?.source || null
}

function parsePlayerDetails(markdown, slug) {
  const body = String(markdown || '').replace(/\r/g, '')
  const titleMatch = body.match(/^Title:\s*([^\n]+)/im)
  const headingMatch = body.match(/#\s*\*\*([^*]+)\*\*\s*Age\s*(\d+)/i)
  const liveRatingMatch = body.match(/Live Rating\s*([0-9.,]+)/i)
  const fideRatingMatch = body.match(/FIDE Rating\s*([0-9.,]+)/i)
  const worldRankMatch = body.match(/World Rank#\s*(\d+)/i)
  const countryRankMatch = body.match(/World Rank#\s*\d+\s+([^\n]+?)\s+Rank#\s*(\d+)/i)
  const bornMatch = body.match(/Born\s+([^\n]+)/i)
  const locationMatch = body.match(/Born[^\n]*\n+\s*([^\n]+?)\s+\[FIDE\]/i)
  const fideIdMatch = body.match(/\bID\s*(\d{4,})\b/i)
  const activeYearsMatch = body.match(/Active Years:\s*([0-9]{4}\s*-\s*[0-9]{4})/i)
  const totalGamesMatch = body.match(/Total Games:\s*(\d+)/i)
  const winsMatch = body.match(/Wins:\s*(\d+)\s*\(([^)]+)\)/i)
  const lossesMatch = body.match(/Losses:\s*(\d+)\s*\(([^)]+)\)/i)
  const drawsMatch = body.match(/Draws:\s*(\d+)\s*\(([^)]+)\)/i)
  const totalScoreMatch = body.match(/Total score:\s*([0-9]+%)/i)
  const performanceMatch = body.match(/last active 12 months:\s*([0-9.,]+)/i)
  const rapidMatch = body.match(/\[Rapid\]\([^)]+\)\s*([0-9.,]+)\s*World\s*#(\d+),\s*Peak\s*([0-9.,]+)\s*\(([^)]+)\)/i)
  const blitzMatch = body.match(/\[Blitz\]\([^)]+\)\s*([0-9.,]+)\s*World\s*#(\d+),\s*Peak\s*([0-9.,]+)\s*\(([^)]+)\)/i)

  const imageMatches = [...body.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g)]
    .map((match) => match[1])
    .filter(Boolean)
  const photoUrl = imageMatches.find((url) => /\/file\?id=/i.test(url)) || imageMatches[0] || null

  const links = parsePlayerLinks(body)
  const openings = parseOpenings(body)
  const ratingHistory = parseRatingHistory(body)
  const championships = parseSectionText(body, 'Championships')
  const ratingsSection = parseSectionText(body, 'Ratings')
  const titlesSection = parseSectionText(body, 'Titles')
  const classicalSection = parseSectionText(body, 'Classical Tournaments')
  const teamSection = parseSectionText(body, 'Team Events')
  const sourceUrl = `https://2700chess.com/players/${slug}`
  const gamesArchiveUrl = `https://2700chess.com/games?search=${encodeURIComponent((headingMatch?.[1] || '').trim() || slug)}`

  return {
    slug,
    sourceUrl,
    gamesArchiveUrl,
    title: (titleMatch?.[1] || '').trim() || null,
    name: (headingMatch?.[1] || '').trim() || null,
    age: Number.parseInt(headingMatch?.[2] || '', 10) || null,
    rawPhotoUrl: photoUrl,
    photoUrl,
    liveRating: parseSignedNumber(liveRatingMatch?.[1] || ''),
    fideRating: parseSignedNumber(fideRatingMatch?.[1] || ''),
    worldRank: Number.parseInt(worldRankMatch?.[1] || '', 10) || null,
    country: (countryRankMatch?.[1] || '').trim() || null,
    countryRank: Number.parseInt(countryRankMatch?.[2] || '', 10) || null,
    born: (bornMatch?.[1] || '').trim() || null,
    location: (locationMatch?.[1] || '').trim() || null,
    fideId: (fideIdMatch?.[1] || '').trim() || null,
    activeYears: (activeYearsMatch?.[1] || '').trim() || null,
    totalGames: Number.parseInt(totalGamesMatch?.[1] || '', 10) || null,
    wins: Number.parseInt(winsMatch?.[1] || '', 10) || null,
    winsPct: (winsMatch?.[2] || '').trim() || null,
    losses: Number.parseInt(lossesMatch?.[1] || '', 10) || null,
    lossesPct: (lossesMatch?.[2] || '').trim() || null,
    draws: Number.parseInt(drawsMatch?.[1] || '', 10) || null,
    drawsPct: (drawsMatch?.[2] || '').trim() || null,
    totalScore: (totalScoreMatch?.[1] || '').trim() || null,
    performance12m: parseSignedNumber(performanceMatch?.[1] || ''),
    rapid: rapidMatch
      ? {
          rating: parseSignedNumber(rapidMatch[1]),
          worldRank: Number.parseInt(rapidMatch[2], 10) || null,
          peak: parseSignedNumber(rapidMatch[3]),
          peakAt: (rapidMatch[4] || '').trim() || null
        }
      : null,
    blitz: blitzMatch
      ? {
          rating: parseSignedNumber(blitzMatch[1]),
          worldRank: Number.parseInt(blitzMatch[2], 10) || null,
          peak: parseSignedNumber(blitzMatch[3]),
          peakAt: (blitzMatch[4] || '').trim() || null
        }
      : null,
    links,
    openings,
    ratingHistory,
    sections: {
      championships,
      ratings: ratingsSection,
      titles: titlesSection,
      classicalTournaments: classicalSection,
      teamEvents: teamSection
    },
    rawMarkdown: body
  }
}

function extractUpdatedAt(markdown) {
  const match = markdown.match(/Last update:\s*\n+\s*([^\n]+)/i)
  return match?.[1]?.trim() || null
}

function parseRatings(markdown) {
  const lines = markdown.split(/\r?\n/)
  const rows = []

  for (const line of lines) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())

    if (cells.length < 11) continue

    const rank = Number.parseInt(cells[0], 10)
    const status = parseLiveStatus(cells[1])
    const name = parseNameFromMarkdown(cells[2])
    const playerUrl = parseLinkFromMarkdown(cells[2])
    const playerSlug = extractPlayerSlug(playerUrl)
    const federation = cells[3]
    const rating = parseSignedNumber(cells[4])
    const change = parseSignedNumber(cells[5])
    const games12m = Number.parseInt(cells[7] || '0', 10)
    const delta = parseSignedNumber(cells[8])
    const age = Number.parseInt(cells[10] || '0', 10)

    if (!Number.isFinite(rank) || !name || !Number.isFinite(rating)) continue

    rows.push({
      rank,
      name,
      playerUrl: playerUrl || null,
      playerSlug: playerSlug || null,
      federation,
      rating,
      change,
      isLive: status.isLive,
      liveUrl: status.liveUrl,
      statusRaw: status.statusRaw,
      games12m: Number.isFinite(games12m) ? games12m : 0,
      delta,
      age: Number.isFinite(age) ? age : null
    })
  }

  return rows
}

function normalizeRatingType(rawType) {
  const value = String(rawType || 'classical').trim().toLowerCase()
  return RATING_TYPES.includes(value) ? value : null
}

function parseLimit(rawLimit) {
  const parsed = Number.parseInt(String(rawLimit || ''), 10)
  if (!Number.isFinite(parsed)) return 30
  return Math.max(1, Math.min(30, parsed))
}

async function loadLiveRatings(type, limit) {
  const source = RATING_SOURCES[type]
  const now = Date.now()
  const hasFreshCache = cacheByType[type] && now - cacheTimeByType[type] < CACHE_TTL_MS

  if (hasFreshCache) {
    return {
      ...cacheByType[type],
      ratings: cacheByType[type].ratings.slice(0, limit)
    }
  }

  if (inFlightByType[type]) {
    const data = await inFlightByType[type]
    return {
      ...data,
      ratings: data.ratings.slice(0, limit)
    }
  }

  inFlightByType[type] = (async () => {
    const response = await fetch(source.mirrorUrl, {
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'ChessPro/1.0 (ratings scraper)'
      }
    })

    if (!response.ok) {
      throw new Error(`Ratings source failed (${response.status})`)
    }

    const markdown = await response.text()
    const ratings = parseRatings(markdown)
    const updatedAtText = extractUpdatedAt(markdown)

    if (!ratings.length) {
      throw new Error('Unable to parse live ratings table')
    }

    const data = {
      ratingType: type,
      ratingLabel: source.label,
      source: '2700chess',
      sourceUrl: source.sourceUrl,
      mirroredFrom: source.mirrorUrl,
      updatedAtText,
      fetchedAt: new Date().toISOString(),
      ratings
    }

    cacheByType[type] = data
    cacheTimeByType[type] = Date.now()
    return data
  })()

  try {
    const data = await inFlightByType[type]
    return {
      ...data,
      ratings: data.ratings.slice(0, limit)
    }
  } finally {
    inFlightByType[type] = null
  }
}

function normalizePlayerSlug(rawSlug) {
  const slug = String(rawSlug || '').trim().toLowerCase()
  if (!slug) return null
  if (!/^[a-z0-9._-]+$/.test(slug)) return null
  return slug
}

async function loadPlayerDetails(slug) {
  const now = Date.now()
  const cached = playerCacheBySlug.get(slug)
  const cachedAt = playerCacheTimeBySlug.get(slug) || 0

  if (cached && now - cachedAt < PLAYER_CACHE_TTL_MS) {
    return cached
  }

  if (playerInFlightBySlug.has(slug)) {
    return playerInFlightBySlug.get(slug)
  }

  const inFlight = (async () => {
    const sourceUrl = `https://2700chess.com/players/${slug}`
    const mirrorUrl = `https://r.jina.ai/http://2700chess.com/players/${slug}`

    const response = await fetch(mirrorUrl, {
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'ChessPro/1.0 (player details scraper)'
      }
    })

    if (!response.ok) {
      throw new Error(`Player details source failed (${response.status})`)
    }

    const markdown = await response.text()
    const details = parsePlayerDetails(markdown, slug)

    if (!details?.name) {
      throw new Error('Unable to parse player details')
    }

    let wikipediaThumbnail = null
    try {
      wikipediaThumbnail = await loadWikipediaThumbnail(details?.links?.wikipedia)
    } catch {
      wikipediaThumbnail = null
    }

    const payload = {
      ...details,
      photoUrl: wikipediaThumbnail || details.rawPhotoUrl || null,
      photoSource: wikipediaThumbnail ? 'wikipedia' : (details.rawPhotoUrl ? '2700chess' : null),
      source: '2700chess',
      sourceUrl,
      mirroredFrom: mirrorUrl,
      fetchedAt: new Date().toISOString()
    }

    playerCacheBySlug.set(slug, payload)
    playerCacheTimeBySlug.set(slug, Date.now())
    return payload
  })()

  playerInFlightBySlug.set(slug, inFlight)

  try {
    return await inFlight
  } finally {
    playerInFlightBySlug.delete(slug)
  }
}

async function loadPlayerGames(slug, page, limit) {
  const cacheKey = `${slug}:${page}:${limit}`
  const now = Date.now()
  const cached = playerGamesCacheByKey.get(cacheKey)
  const cachedAt = playerGamesCacheTimeByKey.get(cacheKey) || 0

  if (cached && now - cachedAt < PLAYER_GAMES_CACHE_TTL_MS) {
    return cached
  }

  if (playerGamesInFlightByKey.has(cacheKey)) {
    return playerGamesInFlightByKey.get(cacheKey)
  }

  const inFlight = (async () => {
    const details = await loadPlayerDetails(slug)
    const searchName = details?.name || slug
    const sourceUrl = `https://2700chess.com/games?search=${encodeURIComponent(searchName)}&page=${page}`
    const mirrorUrl = `https://r.jina.ai/http://2700chess.com/games?search=${encodeURIComponent(searchName)}&page=${page}`

    const response = await fetch(mirrorUrl, {
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'ChessPro/1.0 (player games scraper)'
      }
    })

    if (!response.ok) {
      throw new Error(`Player games source failed (${response.status})`)
    }

    const markdown = await response.text()
    const rows = parseGamesTable(markdown)
    const games = rows.slice(0, limit)

    const data = {
      slug,
      playerName: searchName,
      page,
      limit,
      hasMore: rows.length > limit,
      source: '2700chess',
      sourceUrl,
      mirroredFrom: mirrorUrl,
      fetchedAt: new Date().toISOString(),
      games
    }

    playerGamesCacheByKey.set(cacheKey, data)
    playerGamesCacheTimeByKey.set(cacheKey, Date.now())
    return data
  })()

  playerGamesInFlightByKey.set(cacheKey, inFlight)

  try {
    return await inFlight
  } finally {
    playerGamesInFlightByKey.delete(cacheKey)
  }
}

async function loadFideGameDetail(gamePath) {
  const now = Date.now()
  const cached = gameDetailCacheByPath.get(gamePath)
  const cachedAt = gameDetailCacheTimeByPath.get(gamePath) || 0

  if (cached && now - cachedAt < GAME_DETAIL_CACHE_TTL_MS) {
    return cached
  }

  if (gameDetailInFlightByPath.has(gamePath)) {
    return gameDetailInFlightByPath.get(gamePath)
  }

  const inFlight = (async () => {
    const sourceUrl = `https://2700chess.com${gamePath}`
    const mirrorUrl = `https://r.jina.ai/http://2700chess.com${gamePath}`

    const response = await fetch(mirrorUrl, {
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'ChessPro/1.0 (game detail scraper)'
      }
    })

    if (!response.ok) {
      throw new Error(`Game source failed (${response.status})`)
    }

    const markdown = await response.text()
    const title = (markdown.match(/^Title:\s*([^\n]+)/im)?.[1] || '').trim()
    const resultToken = normalizeResultToken((markdown.match(/\*\*(1-0|0-1|1\/2-1\/2)\*\*/i)?.[1] || '').trim())
    const movetext = parseGameMovetext(markdown)

    if (!movetext) {
      throw new Error('Unable to parse game movetext')
    }

    const parts = parseGameTitleParts(title)
    const pgn = buildPgn({
      event: parts.event,
      site: '2700chess.com',
      date: '????.??.??',
      white: parts.white,
      black: parts.black,
      result: resultToken,
      movetext
    })

    const data = {
      gamePath,
      source: '2700chess',
      sourceUrl,
      mirroredFrom: mirrorUrl,
      title,
      white: parts.white,
      black: parts.black,
      event: parts.event,
      result: resultToken,
      movetext,
      pgn,
      fetchedAt: new Date().toISOString()
    }

    gameDetailCacheByPath.set(gamePath, data)
    gameDetailCacheTimeByPath.set(gamePath, Date.now())
    return data
  })()

  gameDetailInFlightByPath.set(gamePath, inFlight)

  try {
    return await inFlight
  } finally {
    gameDetailInFlightByPath.delete(gamePath)
  }
}

router.get('/fide-live', async (req, res) => {
  try {
    const type = normalizeRatingType(req.query.type)
    if (!type) {
      res.status(400).json({
        success: false,
        error: `Invalid rating type. Use one of: ${RATING_TYPES.join(', ')}`
      })
      return
    }

    const limit = parseLimit(req.query.limit)
    const data = await loadLiveRatings(type, limit)
    res.json({ success: true, data })
  } catch (error) {
    res.status(502).json({
      success: false,
      error: error?.message || 'Failed to fetch live ratings'
    })
  }
})

router.get('/fide-player/:slug', async (req, res) => {
  try {
    const slug = normalizePlayerSlug(req.params.slug)
    if (!slug) {
      res.status(400).json({
        success: false,
        error: 'Invalid player slug'
      })
      return
    }

    const data = await loadPlayerDetails(slug)
    res.json({ success: true, data })
  } catch (error) {
    res.status(502).json({
      success: false,
      error: error?.message || 'Failed to fetch player details'
    })
  }
})

router.get('/fide-player/:slug/games', async (req, res) => {
  try {
    const slug = normalizePlayerSlug(req.params.slug)
    if (!slug) {
      res.status(400).json({ success: false, error: 'Invalid player slug' })
      return
    }

    const page = normalizePage(req.query.page)
    const limit = normalizeGamesLimit(req.query.limit)
    const data = await loadPlayerGames(slug, page, limit)
    res.json({ success: true, data })
  } catch (error) {
    res.status(502).json({
      success: false,
      error: error?.message || 'Failed to fetch player games'
    })
  }
})

router.get('/fide-game', async (req, res) => {
  try {
    const gamePath = normalizeGamePath(req.query.path || req.query.url)
    if (!gamePath) {
      res.status(400).json({ success: false, error: 'Invalid game path' })
      return
    }

    const data = await loadFideGameDetail(gamePath)
    res.json({ success: true, data })
  } catch (error) {
    res.status(502).json({
      success: false,
      error: error?.message || 'Failed to fetch game details'
    })
  }
})

export default router
