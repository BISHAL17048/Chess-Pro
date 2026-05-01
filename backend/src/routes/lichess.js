import express from 'express'
import { Chess } from 'chess.js'

const router = express.Router()
const BROADCAST_CACHE_TTL_MS = 25000
const broadcastCache = new Map()
const BROADCAST_TOUR_CACHE_TTL_MS = 180000
const broadcastTourCache = new Map()
const LEARN_CACHE_TTL_MS = 30 * 60 * 1000
let learnCache = null

async function fetchLichess(url, accept = 'application/json') {
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      'User-Agent': 'ChessPro/1.0 (local dev)'
    }
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Lichess request failed (${response.status}): ${text.slice(0, 160)}`)
  }

  return response
}

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

function normalizeBroadcastItems(rows) {
  return rows
    .map((row) => {
      const tour = row?.tour || {}
      const rounds = Array.isArray(row?.rounds) ? row.rounds : []
      const defaultRoundId = row?.defaultRoundId || null
      const activeRound = rounds.find((r) => r?.ongoing) || rounds.find((r) => r?.id === defaultRoundId) || rounds[rounds.length - 1] || null
      const hasUnfinishedRound = rounds.some((round) => !Boolean(round?.finished))

      return {
        id: tour.id,
        name: tour.name || 'Broadcast',
        slug: tour.slug || null,
        url: tour.url || null,
        image: tour.image || null,
        ongoing: Boolean(row?.ongoing || activeRound?.ongoing || hasUnfinishedRound),
        startsAt: activeRound?.startsAt || null,
        defaultRoundId,
        activeRoundId: activeRound?.id || defaultRoundId,
        rounds: rounds.map((round) => ({
          id: round.id,
          name: round.name || 'Round',
          slug: round.slug || null,
          ongoing: Boolean(round.ongoing),
          startsAt: round.startsAt || null,
          finished: Boolean(round.finished),
          url: round.url || null
        }))
      }
    })
    .filter((item) => item.id)
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

const PUZZLE_DIFFICULTIES = new Set(['easiest', 'easier', 'normal', 'harder', 'hardest'])
const PUZZLE_COLORS = new Set(['white', 'black'])
const LIVE_PUZZLE_CACHE_TTL_MS = 20000
const livePuzzleCache = new Map()

function normalizePuzzleAngle(value, fallback = 'mix') {
  const raw = String(value || '').trim()
  if (!raw) return fallback
  if (!/^[a-zA-Z0-9]+$/.test(raw)) return fallback
  return raw
}

function normalizePuzzleDifficulty(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw || !PUZZLE_DIFFICULTIES.has(raw)) return 'normal'
  return raw
}

function normalizePuzzleColor(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw || !PUZZLE_COLORS.has(raw)) return null
  return raw
}

function clampPuzzleBatchSize(value) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return 15
  return Math.max(1, Math.min(50, parsed))
}

function clampVideoCount(value) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return 120
  return Math.max(1, Math.min(500, parsed))
}

function clampVideoPages(value) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return 3
  return Math.max(1, Math.min(10, parsed))
}

function clampBroadcastGameScan(value) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return 24
  return Math.max(1, Math.min(50, parsed))
}

function clampBroadcastPages(value, fallback = 8, cap = 25) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(cap, parsed))
}

const SEARCH_MONTH_LABELS = [
  ['january', 'jan'],
  ['february', 'feb'],
  ['march', 'mar'],
  ['april', 'apr'],
  ['may', 'may'],
  ['june', 'jun'],
  ['july', 'jul'],
  ['august', 'aug'],
  ['september', 'sep'],
  ['october', 'oct'],
  ['november', 'nov'],
  ['december', 'dec']
]

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickBroadcastTimestamp(item) {
  const candidates = [item?.startsAt]
  if (Array.isArray(item?.rounds)) {
    for (const round of item.rounds) {
      candidates.push(round?.startsAt)
    }
  }

  let best = 0
  for (const value of candidates) {
    const ts = Number(value)
    if (Number.isFinite(ts) && ts > best) best = ts
  }
  return best
}

function buildBroadcastSearchHaystack(item) {
  const parts = [item?.name]
  if (Array.isArray(item?.rounds)) {
    parts.push(item.rounds.map((round) => round?.name).join(' '))
  }

  const ts = pickBroadcastTimestamp(item)
  if (ts > 0) {
    const date = new Date(ts)
    const year = String(date.getUTCFullYear())
    const monthIndex = date.getUTCMonth()
    const monthLabels = SEARCH_MONTH_LABELS[monthIndex] || []
    parts.push(year)
    parts.push(...monthLabels)
    parts.push(`${year} ${monthLabels[0] || ''}`)
  }

  return normalizeSearchText(parts.filter(Boolean).join(' '))
}

function matchesRelativeAge(item, normalizedQuery) {
  const ts = pickBroadcastTimestamp(item)
  if (ts <= 0) return null

  const ageMonths = (Date.now() - ts) / (1000 * 60 * 60 * 24 * 30.4375)
  if (!Number.isFinite(ageMonths) || ageMonths < 0) return false

  const yearRangeA = normalizedQuery.match(/(\d+)\s*(?:year|years|yr|yrs)\s*(?:to|-)\s*(\d+)\s*(?:year|years|yr|yrs)/)
  const yearRangeB = normalizedQuery.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*(?:year|years|yr|yrs)/)
  const monthRangeA = normalizedQuery.match(/(\d+)\s*(?:month|months|mon|mons)\s*(?:to|-)\s*(\d+)\s*(?:month|months|mon|mons)/)
  const monthRangeB = normalizedQuery.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*(?:month|months|mon|mons)/)
  const yearsAgo = normalizedQuery.match(/(\d+)\s*(?:year|years|yr|yrs)\s*ago/)
  const monthsAgo = normalizedQuery.match(/(\d+)\s*(?:month|months|mon|mons)\s*ago/)

  if (yearRangeA || yearRangeB) {
    const row = yearRangeA || yearRangeB
    const minYears = Number.parseInt(row[1], 10)
    const maxYears = Number.parseInt(row[2], 10)
    if (!Number.isFinite(minYears) || !Number.isFinite(maxYears)) return false
    const low = Math.min(minYears, maxYears) * 12
    const high = (Math.max(minYears, maxYears) + 1) * 12
    return ageMonths >= low && ageMonths < high
  }

  if (monthRangeA || monthRangeB) {
    const row = monthRangeA || monthRangeB
    const minMonths = Number.parseInt(row[1], 10)
    const maxMonths = Number.parseInt(row[2], 10)
    if (!Number.isFinite(minMonths) || !Number.isFinite(maxMonths)) return false
    const low = Math.min(minMonths, maxMonths)
    const high = Math.max(minMonths, maxMonths) + 1
    return ageMonths >= low && ageMonths < high
  }

  if (yearsAgo) {
    const years = Number.parseInt(yearsAgo[1], 10)
    if (!Number.isFinite(years)) return false
    return ageMonths >= years * 12 && ageMonths < (years + 1) * 12
  }

  if (monthsAgo) {
    const months = Number.parseInt(monthsAgo[1], 10)
    if (!Number.isFinite(months)) return false
    return ageMonths >= months && ageMonths < months + 1
  }

  if (normalizedQuery.includes('months ago')) {
    return ageMonths >= 1 && ageMonths < 12
  }

  if (normalizedQuery.includes('years ago')) {
    return ageMonths >= 12
  }

  return null
}

function isRelativeAgeQuery(rawQuery) {
  const query = normalizeSearchText(rawQuery)
  if (!query) return false

  if (/\b(ago|year|years|yr|yrs|month|months|mon|mons)\b/.test(query)) return true
  if (/\b\d{4}\b/.test(query)) return true
  return false
}

function matchesBroadcastQuery(item, rawQuery) {
  const query = normalizeSearchText(rawQuery)
  if (!query) return true

  const relativeMatch = matchesRelativeAge(item, query)
  if (relativeMatch === false) return false

  const haystack = buildBroadcastSearchHaystack(item)
  if (!haystack) return false
  if (haystack.includes(query)) return true

  const tokens = query.split(' ').filter(Boolean)
  if (!tokens.length) return true
  return tokens.every((token) => haystack.includes(token))
}

function stripTags(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function deDupeTitle(value) {
  const normalized = String(value || '').trim()
  const half = Math.floor(normalized.length / 2)
  if (half <= 8) return normalized
  const left = normalized.slice(0, half).trim()
  const right = normalized.slice(half).trim()
  if (left && right && (left === right || left.startsWith(right) || right.startsWith(left))) {
    return left.length >= right.length ? left : right
  }
  return normalized
}

function extractLearnAssetUrls(html) {
  const source = String(html || '')
  const learnJsMatch = source.match(/https:\/\/lichess1\.org\/assets\/compiled\/learn\.[^"\s>]+\.js/)
  const i18nLearnJsMatch = source.match(/https:\/\/lichess1\.org\/assets\/compiled\/i18n\/learn\.[^"\s>]+\.js/)

  return {
    learnJsUrl: learnJsMatch?.[0] || '',
    i18nLearnJsUrl: i18nLearnJsMatch?.[0] || ''
  }
}

function decodeLearnJsString(raw) {
  const value = String(raw || '')
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function parseLearnTranslations(i18nLearnJs) {
  const source = String(i18nLearnJs || '')
  const rowRe = /i\['([^']+)'\]="((?:\\.|[^"\\])*)";/g
  const translations = {}
  let match

  while ((match = rowRe.exec(source)) !== null) {
    const key = String(match[1] || '').trim()
    if (!key) continue
    translations[key] = decodeLearnJsString(match[2] || '')
  }

  return translations
}

function parseNumberFromStageBlock(block, keys) {
  for (const key of keys) {
    const match = String(block || '').match(new RegExp(`${key}:\\s*(\\d+)`))
    if (match?.[1]) {
      const value = Number(match[1])
      if (Number.isFinite(value)) return value
    }
  }
  return null
}

function parseStringFromStageBlock(block, keys) {
  for (const key of keys) {
    const match = String(block || '').match(new RegExp(`${key}:"([^"\\n]+)"`))
    if (match?.[1]) return String(match[1]).trim()
  }
  return null
}

function parseArrayStringsFromStageBlock(block, keys) {
  for (const key of keys) {
    const match = String(block || '').match(new RegExp(`${key}:\\[([^\\]]+)\\]`))
    if (!match?.[1]) continue
    const values = String(match[1])
      .split(',')
      .map((row) => row.replace(/^\s*"|"\s*$/g, '').trim())
      .filter(Boolean)
    if (values.length) return values
  }
  return []
}

function parseStageElements(segment, moduleKey, translations) {
  const source = String(segment || '')
  const stageBlocks = [...source.matchAll(/\{[^{}]*goal:i18n\.learn\.([a-zA-Z0-9_]+)[^{}]*\}/g)]

  return stageBlocks.map((row, idx) => {
    const goalKey = String(row?.[1] || '').trim()
    const block = String(row?.[0] || '')
    const title = translations[goalKey] || goalKey || `Stage ${idx + 1}`

    const stage = {
      id: `${moduleKey}-stage-${idx + 1}`,
      key: goalKey || `${moduleKey}_stage_${idx + 1}`,
      title,
      lessonIndex: idx + 1,
      moveCount: parseNumberFromStageBlock(block, ['nbMoves', 'moves', 'maxMoves']),
      stars: parseNumberFromStageBlock(block, ['stars', 'rating']),
      orientation: parseStringFromStageBlock(block, ['orientation', 'color', 'turn']),
      fen: parseStringFromStageBlock(block, ['fen', 'initialFen', 'position']),
      pieces: parseArrayStringsFromStageBlock(block, ['pieces', 'targets']),
      arrows: parseArrayStringsFromStageBlock(block, ['arrows', 'hints']),
      stageType: parseStringFromStageBlock(block, ['type', 'kind', 'mode'])
    }

    return stage
  })
}

function collectLearnTextElements(segment, translations) {
  const source = String(segment || '')
  const keys = [...source.matchAll(/i18n\.learn\.([a-zA-Z0-9_]+)/g)]
    .map((row) => String(row?.[1] || '').trim())
    .filter(Boolean)

  const uniqueKeys = Array.from(new Set(keys))
  return uniqueKeys
    .map((key) => ({ key, value: translations[key] || key }))
    .slice(0, 80)
}

function collectLearnAssets(segment) {
  const source = String(segment || '')
  const imageRefs = [...source.matchAll(/(?:image|sprite|background|icon):"([^"]+)"/g)]
    .map((row) => String(row?.[1] || '').trim())
    .filter(Boolean)

  const unique = Array.from(new Set(imageRefs))
  return unique.map((asset) => {
    if (/^https?:\/\//i.test(asset)) return asset
    if (asset.startsWith('/')) return `https://lichess1.org${asset}`
    return `https://lichess1.org/${asset}`
  })
}

function parseLearnModules(learnJs, translations) {
  const source = String(learnJs || '')
  const metaRe = /key:"([^"]+)",title:i18n\.learn\.([a-zA-Z0-9_]+),subtitle:i18n\.learn\.([a-zA-Z0-9_]+)/g
  const hits = []
  let match

  while ((match = metaRe.exec(source)) !== null) {
    hits.push({
      key: String(match[1] || '').trim(),
      titleKey: String(match[2] || '').trim(),
      subtitleKey: String(match[3] || '').trim(),
      index: match.index
    })
  }

  return hits
    .map((hit, idx) => {
      const nextIndex = idx + 1 < hits.length ? hits[idx + 1].index : source.length
      const segment = source.slice(hit.index, nextIndex)
      const introMatch = segment.match(/intro:i18n\.learn\.([a-zA-Z0-9_]+)/)
      const descMatch = segment.match(/desc:i18n\.learn\.([a-zA-Z0-9_]+)/)
      const imageMatch = segment.match(/image:"([^"]+)"/)
      const iconMatch = segment.match(/icon:"([^"]+)"/)
      const levelCount = (segment.match(/goal:i18n\.learn\./g) || []).length
      const goalMatches = [...segment.matchAll(/goal:i18n\.learn\.([a-zA-Z0-9_]+)/g)]
      const stages = goalMatches
        .map((row, stageIndex) => {
          const key = String(row?.[1] || '').trim()
          if (!key) return null

          const around = segment.slice(Math.max(0, row.index - 120), Math.min(segment.length, row.index + 160))
          const moveCountMatch = around.match(/(?:nbMoves|moves):\s*(\d+)/)
          const starsMatch = around.match(/(?:stars|rating):\s*(\d+)/)

          return {
            id: `${hit.key}-stage-${stageIndex + 1}`,
            key,
            title: translations[key] || key,
            lessonIndex: stageIndex + 1,
            moveCount: moveCountMatch?.[1] ? Number(moveCountMatch[1]) : null,
            stars: starsMatch?.[1] ? Number(starsMatch[1]) : null
          }
        })
        .filter(Boolean)

      const stageTitles = stages.map((stage) => stage.title)
      const uniqueStageTitles = Array.from(new Set(stageTitles))
      const imageUrl = imageMatch?.[1]
        ? (String(imageMatch[1]).startsWith('http') ? String(imageMatch[1]) : `https://lichess1.org${String(imageMatch[1]).startsWith('/') ? '' : '/'}${String(imageMatch[1])}`)
        : null
      const parsedStages = parseStageElements(segment, hit.key, translations)
      const textElements = collectLearnTextElements(segment, translations)
      const assets = collectLearnAssets(segment)

      return {
        id: hit.key,
        key: hit.key,
        title: translations[hit.titleKey] || hit.titleKey,
        subtitle: translations[hit.subtitleKey] || hit.subtitleKey,
        intro: introMatch?.[1] ? (translations[introMatch[1]] || introMatch[1]) : '',
        description: descMatch?.[1] ? (translations[descMatch[1]] || descMatch[1]) : '',
        icon: iconMatch?.[1] || null,
        image: imageUrl,
        lessons: Math.max(1, levelCount || 1),
        stages,
        stageElements: parsedStages,
        stageTitles: uniqueStageTitles,
        textElements,
        assets,
        translationKeys: {
          title: hit.titleKey,
          subtitle: hit.subtitleKey,
          intro: introMatch?.[1] || null,
          description: descMatch?.[1] || null
        },
        url: `https://lichess.org/learn#${encodeURIComponent(hit.key)}`
      }
    })
    .filter((row) => row.id && row.title)
}

function extractLearnPageElements(html) {
  const source = String(html || '')
  if (!source) {
    return {
      title: 'Lichess Learn',
      heading: 'Learn chess in your app',
      subtitle: '',
      badges: []
    }
  }

  const titleMatch = source.match(/<title>([^<]+)<\/title>/i)
  const headingMatch = source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const subtitleMatch = source.match(/<p[^>]*class="[^"]*(?:subtitle|lead|intro)[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
  const badgeMatches = [...source.matchAll(/<span[^>]*class="[^"]*(?:badge|chip|pill)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)]

  return {
    title: stripTags(titleMatch?.[1] || 'Lichess Learn').trim(),
    heading: stripTags(headingMatch?.[1] || 'Learn chess in your app').trim(),
    subtitle: stripTags(subtitleMatch?.[1] || '').trim(),
    badges: badgeMatches
      .map((row) => stripTags(row?.[1] || '').trim())
      .filter(Boolean)
      .slice(0, 8)
  }
}

function applyUciMove(chess, uci) {
  const raw = String(uci || '').trim().toLowerCase()
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(raw)) return null
  try {
    return chess.move({
      from: raw.slice(0, 2),
      to: raw.slice(2, 4),
      promotion: raw.length > 4 ? raw[4] : undefined
    })
  } catch {
    return null
  }
}

function tokenizeLoosePgnMoves(pgnText) {
  const clean = String(pgnText || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\$\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!clean) return []

  const resultTokens = new Set(['1-0', '0-1', '1/2-1/2', '*'])
  return clean
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.replace(/^\d+\.(\.\.)?/, '').replace(/[!?]+/g, ''))
    .filter((token) => token && !resultTokens.has(token))
}

function buildStateFromPgnAtPly(pgn, plyCount) {
  const text = String(pgn || '').trim()
  if (!text) return null

  const setup = new Chess()
  let applied = 0

  const strictGame = new Chess()
  let parsedMoves = []
  try {
    strictGame.loadPgn(text, { strict: false })
    parsedMoves = strictGame.history({ verbose: true })
  } catch {
    parsedMoves = []
  }

  if (parsedMoves.length) {
    const count = Math.max(0, Math.min(Number(plyCount || 0), parsedMoves.length))
    for (let i = 0; i < count; i += 1) {
      const move = parsedMoves[i]
      const ok = setup.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' })
      if (!ok) break
      applied += 1
    }
  } else {
    const looseMoves = tokenizeLoosePgnMoves(text)
    const count = Math.max(0, Math.min(Number(plyCount || 0), looseMoves.length))
    for (let i = 0; i < count; i += 1) {
      let ok = null
      try {
        ok = setup.move(looseMoves[i], { sloppy: true })
      } catch {
        ok = null
      }
      if (!ok) break
      applied += 1
    }
  }

  if (!applied && Number(plyCount || 0) > 0) return null

  const history = setup.history({ verbose: true })
  const last = history.length ? history[history.length - 1] : null
  return {
    game: setup,
    lastMove: last
      ? `${last.from}${last.to}${last.promotion || ''}`
      : null
  }
}

function normalizePuzzlePayload(row) {
  const puzzle = row?.puzzle || null
  if (!puzzle) return row

  const firstSolution = Array.isArray(puzzle.solution) ? puzzle.solution[0] : null
  const pgn = String(row?.game?.pgn || '').trim()
  const initialPly = Number(puzzle.initialPly || 0)

  const candidates = []

  const fen = String(puzzle.fen || '').trim()
  if (fen) {
    try {
      const fromFen = new Chess(fen)
      candidates.push({ game: fromFen, lastMove: puzzle.lastMove || null, source: 'fen' })
    } catch {
      // Ignore malformed fen.
    }
  }

  if (pgn) {
    const atInitial = buildStateFromPgnAtPly(pgn, initialPly)
    if (atInitial?.game) candidates.push({ ...atInitial, source: 'pgn-initial' })
    const atInitialPlusOne = buildStateFromPgnAtPly(pgn, initialPly + 1)
    if (atInitialPlusOne?.game) candidates.push({ ...atInitialPlusOne, source: 'pgn-initial-plus-one' })
  }

  const best = candidates.find((candidate) => {
    if (!firstSolution) return true
    const probe = new Chess(candidate.game.fen())
    return Boolean(applyUciMove(probe, firstSolution))
  }) || candidates[0]

  if (!best?.game) return row

  return {
    ...row,
    puzzle: {
      ...puzzle,
      fen: best.game.fen(),
      lastMove: best.lastMove || puzzle.lastMove || null,
      setupSource: best.source || null
    }
  }
}

function isPlayableNormalizedPuzzle(row) {
  const puzzle = row?.puzzle || null
  if (!puzzle) return false

  const firstSolution = Array.isArray(puzzle.solution) ? String(puzzle.solution[0] || '').trim() : ''
  if (!firstSolution) return false

  const fen = String(puzzle.fen || '').trim()
  if (!fen) return false

  let probe
  try {
    probe = new Chess(fen)
  } catch {
    return false
  }

  return Boolean(applyUciMove(probe, firstSolution))
}

async function fillWithPlayableNext(byId, targetCount, { angle, difficulty, color, maxAttempts = 30 }) {
  let attempts = 0

  while (byId.size < targetCount && attempts < maxAttempts) {
    attempts += 1

    const params = new URLSearchParams({ angle, difficulty })
    if (color) params.set('color', color)

    try {
      const response = await fetchLichess(`https://lichess.org/api/puzzle/next?${params.toString()}`)
      const normalized = normalizePuzzlePayload(await response.json())
      const id = normalized?.puzzle?.id
      if (!id || byId.has(id)) continue
      if (!isPlayableNormalizedPuzzle(normalized)) continue
      byId.set(id, normalized)
    } catch {
      // Retry up to maxAttempts.
    }
  }
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/')
    .replace(/&#x27;/g, "'")
}

function parseBroadcastCardsFromHtml(html) {
  const source = String(html || '')
  if (!source) return []

  const cardRe = /<a\s+href="([^"]+)"\s+class="relay-card[^\"]*"[^>]*>([\s\S]*?)<\/a>/gi
  const titleRe = /<h3[^>]*class="relay-card__title"[^>]*>([\s\S]*?)<\/h3>/i
  const imgRe = /<img[^>]*class="relay-card__image"[^>]*src="([^"]+)"/i
  const timeRe = /<time[^>]*datetime="([^"]+)"/i
  const playersRe = /<span[^>]*class="relay-card__players"[^>]*>([\s\S]*?)<\/span>/i
  const playerNameRe = /<span[^>]*>([\s\S]*?)<\/span>/gi

  const rows = []
  let match

  while ((match = cardRe.exec(source)) !== null) {
    const hrefRaw = String(match[1] || '').trim()
    const body = String(match[2] || '')
    if (!hrefRaw) continue

    const titleMatch = body.match(titleRe)
    const imageMatch = body.match(imgRe)
    const timeMatch = body.match(timeRe)
    const playersMatch = body.match(playersRe)

    const title = decodeHtmlEntities(stripTags(titleMatch?.[1] || '')).trim()
    if (!title) continue

    const href = hrefRaw.startsWith('http') ? hrefRaw : `https://lichess.org${hrefRaw}`
    const image = imageMatch?.[1] ? decodeHtmlEntities(String(imageMatch[1])) : null
    const startsAt = timeMatch?.[1] ? Date.parse(String(timeMatch[1])) : null

    let players = []
    if (playersMatch?.[1]) {
      const chunk = String(playersMatch[1] || '')
      let p
      while ((p = playerNameRe.exec(chunk)) !== null) {
        const name = decodeHtmlEntities(stripTags(p?.[1] || '')).trim()
        if (name) players.push(name)
      }
    }

    const parts = hrefRaw.split('/').filter(Boolean)
    // /broadcast/{slug}/{roundSlug}/{roundId}
    const broadcastIdx = parts.findIndex((part) => part === 'broadcast')
    const slug = broadcastIdx >= 0 ? String(parts[broadcastIdx + 1] || '') : ''
    const roundSlug = broadcastIdx >= 0 ? String(parts[broadcastIdx + 2] || '') : ''
    const roundId = broadcastIdx >= 0 ? String(parts[broadcastIdx + 3] || '') : ''

    rows.push({
      id: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      slug: slug || null,
      name: title,
      image,
      startsAt: Number.isFinite(startsAt) ? startsAt : null,
      href,
      roundId: roundId || null,
      roundSlug: roundSlug || null,
      players
    })
  }

  return rows
}

function collapseBroadcastCardRows(rows) {
  const grouped = new Map()

  for (const row of rows) {
    const key = String(row?.id || row?.name || '').trim()
    if (!key) continue

    const existing = grouped.get(key) || {
      id: key,
      name: row?.name || 'Broadcast',
      slug: row?.slug || null,
      url: row?.slug ? `https://lichess.org/broadcast/${encodeURIComponent(String(row.slug))}` : null,
      image: row?.image || null,
      ongoing: false,
      startsAt: row?.startsAt || null,
      defaultRoundId: row?.roundId || null,
      activeRoundId: row?.roundId || null,
      rounds: [],
      players: []
    }

    if (!existing.image && row?.image) existing.image = row.image
    if ((!existing.startsAt || Number(existing.startsAt) < Number(row?.startsAt || 0)) && row?.startsAt) {
      existing.startsAt = row.startsAt
      if (row?.roundId) {
        existing.defaultRoundId = row.roundId
        existing.activeRoundId = row.roundId
      }
    }

    if (Array.isArray(row?.players) && row.players.length) {
      existing.players = [...new Set([...(existing.players || []), ...row.players])].slice(0, 12)
    }

    if (row?.roundId) {
      const hasRound = existing.rounds.some((round) => String(round?.id || '') === String(row.roundId))
      if (!hasRound) {
        existing.rounds.push({
          id: row.roundId,
          name: row.roundSlug ? decodeHtmlEntities(String(row.roundSlug).replace(/-/g, ' ')) : 'Round',
          slug: row.roundSlug || null,
          ongoing: false,
          startsAt: row?.startsAt || null,
          finished: true,
          url: row?.href || null
        })
      }
    }

    grouped.set(key, existing)
  }

  return Array.from(grouped.values())
}

function parseRoundsFromBroadcastTourHtml(html) {
  const source = String(html || '')
  if (!source) return []

  const linkRe = /<a[^>]+href="(\/broadcast\/[^"\s]+\/([^\/"]+)\/([A-Za-z0-9]+))"[^>]*>([\s\S]*?)<\/a>/gi
  const seen = new Set()
  const rounds = []
  let match

  while ((match = linkRe.exec(source)) !== null) {
    const href = String(match[1] || '').trim()
    const roundSlug = String(match[2] || '').trim()
    const roundId = String(match[3] || '').trim()
    if (!href || !roundId || !roundSlug || !roundSlug.startsWith('round-')) continue
    if (seen.has(roundId)) continue
    seen.add(roundId)

    const inner = String(match[4] || '')
    const text = decodeHtmlEntities(stripTags(inner)).trim()

    rounds.push({
      id: roundId,
      name: text || roundSlug.replace(/-/g, ' '),
      slug: roundSlug,
      ongoing: false,
      startsAt: null,
      finished: true,
      url: `https://lichess.org${href}`
    })
  }

  return rounds
}

function extractRoundNumber(round) {
  const text = String(round?.name || round?.slug || '').toLowerCase()
  const match = text.match(/round\s*-?\s*(\d+)/i) || text.match(/\b(\d+)\b/)
  if (!match) return null
  const value = Number.parseInt(match[1], 10)
  return Number.isFinite(value) ? value : null
}

function hasLikelyCompleteRoundSet(rounds) {
  const list = Array.isArray(rounds) ? rounds : []
  if (list.length <= 1) return false

  const numbers = list
    .map((round) => extractRoundNumber(round))
    .filter((value) => Number.isFinite(value))

  if (!numbers.length) return list.length >= 4

  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  if (min > 1) return false

  const unique = new Set(numbers)
  // Accept only mostly contiguous numbered rounds.
  return unique.size >= Math.max(3, max - 1)
}

function mergeAndSortRounds(baseRounds = [], incomingRounds = []) {
  const seen = new Set()
  const merged = []

  for (const round of [...incomingRounds, ...baseRounds]) {
    const key = String(round?.id || '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(round)
  }

  merged.sort((a, b) => {
    const aNum = extractRoundNumber(a)
    const bNum = extractRoundNumber(b)
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum

    const aTime = Number(a?.startsAt || 0)
    const bTime = Number(b?.startsAt || 0)
    return aTime - bTime
  })

  return merged
}

function parseVideoPage(html, page) {
  const videoRe = /<a[^>]+href="\/video\/([^"?#/]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  const levelRe = /\b(BEGINNER|INTERMEDIATE|ADVANCED|MASTER)\b/i
  const rows = []
  const seen = new Set()
  let match

  while ((match = videoRe.exec(html)) !== null) {
    const id = String(match[1] || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)

    const rawText = stripTags(match[2] || '')
    if (!rawText) continue

    const levelMatch = rawText.match(levelRe)
    const level = levelMatch ? levelMatch[1].toUpperCase() : ''
    const textWithoutLevel = level ? rawText.replace(levelRe, '').trim() : rawText
    const compactTitle = deDupeTitle(textWithoutLevel)

    rows.push({
      id,
      title: compactTitle || `Video ${id}`,
      level: level || null,
      page,
      lichessUrl: `https://lichess.org/video/${encodeURIComponent(id)}`,
      embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(id)}`
    })
  }

  const hasNext = /\bNext\b/i.test(html) && /\/video\?[^"']*page=/i.test(html)
  return { videos: rows, hasNext }
}

function normalizePotentialStreamUrl(rawUrl) {
  const url = String(rawUrl || '').trim()
  if (!url) return ''

  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('/')) return `https://lichess.org${url}`
  return url
}

function inferStreamPlatform(url) {
  const value = String(url || '').toLowerCase()
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'youtube'
  if (value.includes('twitch.tv')) return 'twitch'
  if (value.includes('kick.com')) return 'kick'
  return 'stream'
}

function extractBroadcastStreamsFromHtml(html) {
  const source = String(html || '')
  if (!source) return []

  const patterns = [
    /<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi,
    /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]{6,}/gi,
    /https?:\/\/(?:www\.)?youtube\.com\/embed\/[a-zA-Z0-9_-]{6,}/gi,
    /https?:\/\/youtu\.be\/[a-zA-Z0-9_-]{6,}/gi,
    /https?:\/\/(?:www\.)?twitch\.tv\/[a-zA-Z0-9_]+/gi,
    /https?:\/\/(?:www\.)?player\.twitch\.tv\/[^"'\s<>]+/gi,
    /https?:\/\/(?:www\.)?kick\.com\/[a-zA-Z0-9_-]+/gi
  ]

  const urls = new Set()

  for (const regex of patterns) {
    let match
    while ((match = regex.exec(source)) !== null) {
      const captured = Array.isArray(match) ? (match[1] || match[0]) : ''
      const normalized = normalizePotentialStreamUrl(captured)
      if (!normalized) continue
      if (!/^https?:\/\//i.test(normalized)) continue
      urls.add(normalized)
    }
  }

  return [...urls].map((url, index) => ({
    id: `broadcast-stream-${index + 1}`,
    name: 'Broadcast Stream',
    title: 'Lichess Broadcast',
    headline: url,
    online: true,
    streamerUrl: null,
    stream: {
      platform: inferStreamPlatform(url),
      url,
      status: 'Live broadcast',
      viewers: 0
    }
  }))
}

router.get('/games/user/:username', async (req, res) => {
  try {
    const username = String(req.params.username || '').trim()
    if (!username) {
      res.status(400).json({ success: false, error: 'Username is required' })
      return
    }

    const max = Math.max(1, Math.min(20, Number(req.query.max || 10)))
    const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&moves=true&pgnInJson=true&opening=true&clocks=false&evals=false`

    const response = await fetchLichess(url, 'application/x-ndjson')
    const ndjson = await response.text()
    const rows = parseNdjson(ndjson)

    const games = rows.map((g) => ({
      id: g.id,
      createdAt: g.createdAt,
      lastMoveAt: g.lastMoveAt,
      winner: g.winner || null,
      status: g.status || null,
      opening: g.opening?.name || 'Unknown opening',
      white: g.players?.white?.user?.name || g.players?.white?.name || 'White',
      black: g.players?.black?.user?.name || g.players?.black?.name || 'Black',
      pgn: g.pgn || ''
    }))

    res.json({ success: true, data: { username, games } })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch Lichess games' })
  }
})

router.get('/puzzle/daily', async (req, res) => {
  try {
    const response = await fetchLichess('https://lichess.org/api/puzzle/daily')
    const normalizedDaily = normalizePuzzlePayload(await response.json())

    if (isPlayableNormalizedPuzzle(normalizedDaily)) {
      res.json({ success: true, data: normalizedDaily })
      return
    }

    const byId = new Map()
    await fillWithPlayableNext(byId, 1, {
      angle: 'mix',
      difficulty: 'normal',
      color: null,
      maxAttempts: 12
    })

    const fallback = byId.values().next().value
    if (!fallback) {
      throw new Error('Unable to fetch a playable daily puzzle from Lichess')
    }

    res.json({ success: true, data: fallback })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch daily puzzle' })
  }
})

router.get('/puzzle/next', async (req, res) => {
  try {
    const angle = normalizePuzzleAngle(req.query.angle, 'mix')
    const difficulty = normalizePuzzleDifficulty(req.query.difficulty)
    const color = normalizePuzzleColor(req.query.color)

    const params = new URLSearchParams({
      angle,
      difficulty
    })

    if (color) {
      params.set('color', color)
    }

    const byId = new Map()

    const response = await fetchLichess(`https://lichess.org/api/puzzle/next?${params.toString()}`)
    const first = normalizePuzzlePayload(await response.json())
    const firstId = first?.puzzle?.id
    if (firstId && isPlayableNormalizedPuzzle(first)) {
      byId.set(firstId, first)
    }

    if (!byId.size) {
      await fillWithPlayableNext(byId, 1, {
        angle,
        difficulty,
        color,
        maxAttempts: 12
      })
    }

    const data = byId.values().next().value
    if (!data) {
      throw new Error('Unable to fetch a playable puzzle from Lichess')
    }

    res.json({
      success: true,
      data: {
        ...data,
        filters: {
          angle,
          difficulty,
          color: color || 'auto'
        }
      }
    })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch next puzzle' })
  }
})

router.get('/puzzle/batch/:angle', async (req, res) => {
  try {
    const angle = normalizePuzzleAngle(req.params.angle, 'mix')
    const difficulty = normalizePuzzleDifficulty(req.query.difficulty)
    const nb = clampPuzzleBatchSize(req.query.nb)
    const color = normalizePuzzleColor(req.query.color)

    const params = new URLSearchParams({
      difficulty,
      nb: String(nb)
    })

    if (color && nb === 1) {
      params.set('color', color)
    }

    const response = await fetchLichess(`https://lichess.org/api/puzzle/batch/${encodeURIComponent(angle)}?${params.toString()}`)
    const data = await response.json()
    const byId = new Map()
    const incoming = Array.isArray(data?.puzzles) ? data.puzzles : []

    for (const row of incoming) {
      const normalized = normalizePuzzlePayload(row)
      const id = normalized?.puzzle?.id
      if (!id || byId.has(id)) continue
      if (!isPlayableNormalizedPuzzle(normalized)) continue
      byId.set(id, normalized)
    }

    if (byId.size < nb) {
      await fillWithPlayableNext(byId, nb, {
        angle,
        difficulty,
        color,
        maxAttempts: Math.max(15, nb * 3)
      })
    }

    const puzzles = Array.from(byId.values()).slice(0, nb)

    res.json({
      success: true,
      data: {
        angle,
        difficulty,
        color: nb === 1 ? (color || 'auto') : 'auto',
        count: puzzles.length,
        puzzles,
        glicko: data?.glicko || null
      }
    })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch puzzle batch' })
  }
})

router.get('/puzzle/live', async (req, res) => {
  try {
    const angle = normalizePuzzleAngle(req.query.angle, 'mix')
    const difficulty = normalizePuzzleDifficulty(req.query.difficulty)
    const color = normalizePuzzleColor(req.query.color)
    const count = clampPuzzleBatchSize(req.query.count)
    const cacheKey = `${angle}|${difficulty}|${color || 'auto'}|${count}`
    const now = Date.now()
    const cached = livePuzzleCache.get(cacheKey)
    if (cached && now - cached.ts <= LIVE_PUZZLE_CACHE_TTL_MS) {
      res.json({ success: true, data: cached.data })
      return
    }

    const byId = new Map()
    const pushPuzzles = (rows) => {
      for (const row of Array.isArray(rows) ? rows : []) {
        const normalized = normalizePuzzlePayload(row)
        const id = normalized?.puzzle?.id
        if (!id || byId.has(id)) continue
        if (!isPlayableNormalizedPuzzle(normalized)) continue
        byId.set(id, normalized)
      }
    }

    // Fast path: one batch call provides most or all required live puzzles.
    const batchParams = new URLSearchParams({
      difficulty,
      nb: String(Math.min(50, count))
    })
    if (color && count === 1) {
      batchParams.set('color', color)
    }

    try {
      const batchResponse = await fetchLichess(`https://lichess.org/api/puzzle/batch/${encodeURIComponent(angle)}?${batchParams.toString()}`)
      const batchData = await batchResponse.json()
      pushPuzzles(batchData?.puzzles)
    } catch {
      // If batch fails, we still try next-puzzle calls below.
    }

    if (byId.size < count) {
      await fillWithPlayableNext(byId, count, {
        angle,
        difficulty,
        color,
        maxAttempts: Math.max(18, count * 4)
      })
    }

    const puzzles = Array.from(byId.values()).slice(0, count)
    if (!puzzles.length) {
      throw new Error('Unable to fetch live puzzles from Lichess')
    }

    const responseData = {
      angle,
      difficulty,
      color: color || 'auto',
      count: puzzles.length,
      source: 'lichess-live',
      puzzles
    }

    livePuzzleCache.set(cacheKey, {
      ts: now,
      data: responseData
    })

    res.json({
      success: true,
      data: responseData
    })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch live puzzles' })
  }
})

router.get('/tournaments', async (req, res) => {
  try {
    const response = await fetchLichess('https://lichess.org/api/tournament')
    const data = await response.json()
    res.json({ success: true, data })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch tournaments' })
  }
})

router.get('/tournaments/:id/games', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim()
    if (!id) {
      res.status(400).json({ success: false, error: 'Tournament id is required' })
      return
    }

    const max = Math.max(1, Math.min(30, Number(req.query.max || 12)))
    const url = `https://lichess.org/api/tournament/${encodeURIComponent(id)}/games?max=${max}&moves=true&pgnInJson=true&opening=true&clocks=false&evals=false`

    const response = await fetchLichess(url, 'application/x-ndjson')
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

    res.json({ success: true, data: { id, games } })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch tournament games' })
  }
})

router.get('/tv', async (req, res) => {
  try {
    const channel = String(req.query.channel || 'blitz').toLowerCase()
    const channelsResponse = await fetchLichess('https://lichess.org/api/tv/channels')
    const channelsData = await channelsResponse.json()

    let game = null
    try {
      const gameResponse = await fetchLichess(`https://lichess.org/api/tv/${encodeURIComponent(channel)}`)
      game = await gameResponse.json()
    } catch {
      game = null
    }

    res.json({
      success: true,
      data: {
        channel,
        channels: channelsData,
        game
      }
    })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch Lichess TV data' })
  }
})

router.get('/tv/feed', async (req, res) => {
  try {
    const channel = String(req.query.channel || 'blitz').toLowerCase()
    const response = await fetchLichess(`https://lichess.org/api/tv/${encodeURIComponent(channel)}/feed`, 'application/x-ndjson')
    const raw = await response.text()
    const events = parseNdjson(raw)

    res.json({
      success: true,
      data: {
        channel,
        events: events.slice(-20)
      }
    })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch Lichess TV feed' })
  }
})

router.get('/streamers/live', async (req, res) => {
  try {
    const max = Math.max(1, Math.min(24, Number(req.query.max || 12)))
    const response = await fetchLichess('https://lichess.org/api/streamer/live')
    const raw = await response.text()

    let rows = []
    try {
      const parsed = JSON.parse(raw)
      rows = Array.isArray(parsed) ? parsed : []
    } catch {
      rows = parseNdjson(raw)
    }

    const streamers = rows
      .map((row) => ({
        id: String(row?.id || row?.name || ''),
        name: String(row?.name || 'Streamer'),
        title: String(row?.title || ''),
        headline: String(row?.headline || ''),
        language: String(row?.lang || ''),
        online: Boolean(row?.streaming || row?.live || row?.online),
        streamerUrl: row?.url || (row?.name ? `https://lichess.org/streamer/${encodeURIComponent(String(row.name))}` : null),
        stream: {
          platform: String(row?.stream?.service || row?.stream?.platform || ''),
          url: String(row?.stream?.url || ''),
          status: String(row?.stream?.status || row?.stream?.title || ''),
          viewers: Number(row?.stream?.viewers || 0)
        }
      }))
      .filter((row) => row.id && row.stream.url)
      .slice(0, max)

    res.json({ success: true, data: { streamers } })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch live streamers' })
  }
})

router.get('/videos', async (req, res) => {
  try {
    const max = clampVideoCount(req.query.max)
    const maxPages = clampVideoPages(req.query.pages)
    const tags = String(req.query.tags || '').trim()

    const allVideos = []
    const seen = new Set()

    let hasNext = true
    for (let page = 1; page <= maxPages && hasNext && allVideos.length < max; page += 1) {
      const params = new URLSearchParams()
      if (tags) params.set('tags', tags)
      if (page > 1) params.set('page', String(page))
      const query = params.toString()
      const url = `https://lichess.org/video${query ? `?${query}` : ''}`

      const response = await fetchLichess(url, 'text/html')
      const html = await response.text()
      const parsed = parseVideoPage(html, page)
      hasNext = parsed.hasNext

      for (const row of parsed.videos) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        allVideos.push(row)
        if (allVideos.length >= max) break
      }
    }

    res.json({
      success: true,
      data: {
        tags: tags || null,
        count: allVideos.length,
        videos: allVideos
      }
    })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch chess videos' })
  }
})

router.get('/learn', async (req, res) => {
  try {
    const now = Date.now()
    if (learnCache && now - learnCache.ts < LEARN_CACHE_TTL_MS) {
      res.json({ success: true, data: learnCache.data })
      return
    }

    const pageResponse = await fetchLichess('https://lichess.org/learn', 'text/html')
    const pageHtml = await pageResponse.text()
    const { learnJsUrl, i18nLearnJsUrl } = extractLearnAssetUrls(pageHtml)

    if (!learnJsUrl || !i18nLearnJsUrl) {
      throw new Error('Unable to locate Lichess Learn assets')
    }

    const [learnJsResponse, i18nLearnJsResponse] = await Promise.all([
      fetchLichess(learnJsUrl, 'text/javascript'),
      fetchLichess(i18nLearnJsUrl, 'text/javascript')
    ])

    const [learnJs, i18nLearnJs] = await Promise.all([
      learnJsResponse.text(),
      i18nLearnJsResponse.text()
    ])

    const translations = parseLearnTranslations(i18nLearnJs)
    const modules = parseLearnModules(learnJs, translations)
    const page = extractLearnPageElements(pageHtml)

    const payload = {
      source: 'https://lichess.org/learn',
      refreshedAt: new Date().toISOString(),
      page,
      assets: {
        learnJsUrl,
        i18nLearnJsUrl
      },
      moduleCount: modules.length,
      modules
    }

    learnCache = { ts: now, data: payload }
    res.json({ success: true, data: payload })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch learn content' })
  }
})

router.get('/broadcasts', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim().toLowerCase()
    const useRelativeSearch = isRelativeAgeQuery(query)
    const useRemoteQuery = false
    const maxCap = query ? 3000 : 3000
    const maxDefault = query ? 1600 : 900
    const max = Math.max(1, Math.min(maxCap, Number(req.query.max || maxDefault)))
    const pages = clampBroadcastPages(req.query.pages, query ? 90 : 40, query ? 140 : 140)
    const cacheKey = `${max}:${pages}:${query}:${useRelativeSearch ? 'relative' : (useRemoteQuery ? 'remote' : 'plain')}`
    const now = Date.now()
    const cached = broadcastCache.get(cacheKey)
    if (cached && now - cached.ts < BROADCAST_CACHE_TTL_MS) {
      res.json({ success: true, data: { broadcasts: cached.broadcasts } })
      return
    }

    const merged = []
    const seen = new Set()
  let consecutiveNoGrowth = 0
  let consecutiveErrors = 0

    const batchSize = query ? 6 : 1
    for (let page = 1; page <= pages && merged.length < max; page += batchSize) {
      const pageBatch = []
      for (let offset = 0; offset < batchSize; offset += 1) {
        const currentPage = page + offset
        if (currentPage <= pages) pageBatch.push(currentPage)
      }

      const pageResults = await Promise.all(pageBatch.map(async (currentPage) => {
        const fetchPage = async () => {
          const params = new URLSearchParams({ nb: '60', page: String(currentPage) })

          const response = await fetchLichess(`https://lichess.org/api/broadcast?${params.toString()}`, 'application/x-ndjson')
          const ndjson = await response.text()
          const rows = parseNdjson(ndjson)
          return {
            rows,
            broadcastsPage: normalizeBroadcastItems(rows),
            failed: false
          }
        }

        try {
          return await fetchPage()
        } catch {
          return { rows: [], broadcastsPage: [], failed: true }
        }
      }))

      let reachedEnd = false
      let batchAdded = 0

      for (const result of pageResults) {
        if (result?.failed) {
          consecutiveErrors += 1
          continue
        }

        const rows = Array.isArray(result?.rows) ? result.rows : []
        if (!rows.length) {
          reachedEnd = true
          continue
        }

        const broadcastsPage = Array.isArray(result?.broadcastsPage) ? result.broadcastsPage : []
        for (const item of broadcastsPage) {
          if (!matchesBroadcastQuery(item, query)) continue
          const key = String(item?.id || '')
          if (!key || seen.has(key)) continue
          seen.add(key)
          merged.push(item)
          batchAdded += 1
          if (merged.length >= max) break
        }

        if (rows.length < 60) {
          reachedEnd = true
        }
      }

      if (batchAdded === 0) {
        consecutiveNoGrowth += 1
      } else {
        consecutiveNoGrowth = 0
        consecutiveErrors = 0
      }

      if (consecutiveErrors >= 3) break
      if (query && consecutiveNoGrowth >= 6) break

      if (reachedEnd) break
    }

    if (query && merged.length === 0) {
      const htmlRows = []
      const htmlPages = Math.max(1, Math.min(40, pages))

      for (let page = 1; page <= htmlPages; page += 1) {
        try {
          const params = new URLSearchParams({ q: query })
          if (page > 1) params.set('page', String(page))
          const response = await fetchLichess(`https://lichess.org/broadcast?${params.toString()}`, 'text/html')
          const html = await response.text()
          const rows = parseBroadcastCardsFromHtml(html)
          if (!rows.length) break
          htmlRows.push(...rows)
          if (rows.length < 10) break
        } catch {
          break
        }
      }

      const fallbackBroadcasts = collapseBroadcastCardRows(htmlRows)
      for (const item of fallbackBroadcasts) {
        if (!matchesBroadcastQuery(item, query)) continue
        const key = String(item?.id || '')
        if (!key || seen.has(key)) continue
        seen.add(key)
        merged.push(item)
        if (merged.length >= max) break
      }
    }

    if (!query) {
      try {
        const response = await fetchLichess('https://lichess.org/broadcast', 'text/html')
        const html = await response.text()
        const webRows = parseBroadcastCardsFromHtml(html)
        const webBroadcasts = collapseBroadcastCardRows(webRows)
        for (const item of webBroadcasts) {
          const key = String(item?.id || item?.slug || '')
          if (!key || seen.has(key)) continue
          seen.add(key)
          merged.push({
            ...item,
            ongoing: true
          })
          if (merged.length >= max) break
        }
      } catch {
        // Keep API results if web live merge fails.
      }
    }

    broadcastCache.set(cacheKey, { ts: now, broadcasts: merged })
    res.json({ success: true, data: { broadcasts: merged } })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch broadcasts' })
  }
})

router.get('/broadcasts/round/:roundId', async (req, res) => {
  try {
    const roundId = String(req.params.roundId || '').trim()
    if (!roundId) {
      res.status(400).json({ success: false, error: 'Round id is required' })
      return
    }

    const response = await fetchLichess(`https://lichess.org/api/broadcast/-/-/${encodeURIComponent(roundId)}`)
    const data = await response.json()
    const photos = data?.photos || {}

    const games = Array.isArray(data?.games)
      ? data.games.map((game) => ({
          whitePlayer: game.players?.[0] || null,
          blackPlayer: game.players?.[1] || null,
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
          thinkTime: game.thinkTime || null
        }))
      : []

    res.json({
      success: true,
      data: {
        round: data?.round || null,
        tour: data?.tour || null,
        games
      }
    })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch broadcast round' })
  }
})

router.get('/broadcasts/round/:roundId/tour', async (req, res) => {
  try {
    const roundId = String(req.params.roundId || '').trim()
    if (!roundId) {
      res.status(400).json({ success: false, error: 'Round id is required' })
      return
    }

    const roundResponse = await fetchLichess(`https://lichess.org/api/broadcast/-/-/${encodeURIComponent(roundId)}`)
    const roundData = await roundResponse.json()
    const tourId = String(roundData?.tour?.id || '').trim()

    if (!tourId) {
      res.json({ success: true, data: { broadcast: null } })
      return
    }

    const now = Date.now()
    const cached = broadcastTourCache.get(tourId)
    if (cached && now - cached.ts < BROADCAST_TOUR_CACHE_TTL_MS) {
      const cachedRounds = Array.isArray(cached?.broadcast?.rounds) ? cached.broadcast.rounds : []
      if (hasLikelyCompleteRoundSet(cachedRounds)) {
        res.json({ success: true, data: { broadcast: cached.broadcast } })
        return
      }
      broadcastTourCache.delete(tourId)
    }

    const pages = clampBroadcastPages(req.query.pages, 160, 260)
    const batchSize = 6
    let found = null

    // Primary strategy: parse the current round page, which exposes the full rounds menu.
    try {
      const roundPageResponse = await fetchLichess(`https://lichess.org/broadcast/-/-/${encodeURIComponent(roundId)}`, 'text/html')
      const roundPageHtml = await roundPageResponse.text()
      const htmlRounds = parseRoundsFromBroadcastTourHtml(roundPageHtml)
      if (hasLikelyCompleteRoundSet(htmlRounds)) {
        found = {
          id: tourId,
          name: roundData?.tour?.name || 'Broadcast',
          slug: roundData?.tour?.slug || null,
          url: roundData?.tour?.url || null,
          image: roundData?.tour?.image || null,
          ongoing: Boolean(roundData?.round?.ongoing),
          startsAt: roundData?.round?.startsAt || null,
          defaultRoundId: roundData?.tour?.defaultRoundId || htmlRounds[0]?.id || roundId,
          activeRoundId: roundData?.round?.id || roundId,
          rounds: mergeAndSortRounds([], htmlRounds)
        }
      }
    } catch {
      // Fall through to API scan strategy.
    }

    for (let page = 1; page <= pages && !found; page += batchSize) {
      const pageBatch = []
      for (let offset = 0; offset < batchSize; offset += 1) {
        const currentPage = page + offset
        if (currentPage <= pages) pageBatch.push(currentPage)
      }

      const pageResults = await Promise.all(pageBatch.map(async (currentPage) => {
        try {
          const params = new URLSearchParams({ nb: '60', page: String(currentPage) })
          const response = await fetchLichess(`https://lichess.org/api/broadcast?${params.toString()}`, 'application/x-ndjson')
          const ndjson = await response.text()
          const rows = parseNdjson(ndjson)
          return { rows, failed: false }
        } catch {
          return { rows: [], failed: true }
        }
      }))

      let reachedEnd = false
      for (const result of pageResults) {
        const rows = Array.isArray(result?.rows) ? result.rows : []
        if (!rows.length) {
          reachedEnd = true
          continue
        }

        const hit = rows.find((row) => String(row?.tour?.id || '').trim() === tourId)
        if (hit) {
          found = normalizeBroadcastItems([hit])[0] || null
          break
        }

        if (rows.length < 60) reachedEnd = true
      }

      if (reachedEnd && !found) break
    }

    if (!found) {
      const fallbackRound = roundData?.round || null
      found = {
        id: tourId,
        name: roundData?.tour?.name || 'Broadcast',
        slug: roundData?.tour?.slug || null,
        url: roundData?.tour?.url || null,
        image: roundData?.tour?.image || null,
        ongoing: Boolean(fallbackRound?.ongoing),
        startsAt: fallbackRound?.startsAt || null,
        defaultRoundId: fallbackRound?.id || roundId,
        activeRoundId: fallbackRound?.id || roundId,
        rounds: fallbackRound
          ? [{
              id: fallbackRound.id || roundId,
              name: fallbackRound.name || 'Round',
              slug: fallbackRound.slug || null,
              ongoing: Boolean(fallbackRound.ongoing),
              startsAt: fallbackRound.startsAt || null,
              finished: Boolean(fallbackRound.finished),
              url: fallbackRound.url || null
            }]
          : []
      }
    }

    const foundRounds = Array.isArray(found?.rounds) ? found.rounds : []
    if (!hasLikelyCompleteRoundSet(foundRounds)) {
      try {
        const tourUrl = String(roundData?.tour?.url || '').trim()
        if (tourUrl) {
          const response = await fetchLichess(tourUrl, 'text/html')
          const html = await response.text()
          const htmlRounds = parseRoundsFromBroadcastTourHtml(html)
          if (htmlRounds.length) {
            const mergedRounds = mergeAndSortRounds(foundRounds, htmlRounds)
            found = {
              ...found,
              defaultRoundId: found.defaultRoundId || mergedRounds[0]?.id || null,
              activeRoundId: found.activeRoundId || mergedRounds[0]?.id || null,
              rounds: mergedRounds
            }
          }
        }
      } catch {
        // Keep API rounds if page scrape fails.
      }
    }

    broadcastTourCache.set(tourId, { ts: now, broadcast: found })
    res.json({ success: true, data: { broadcast: found } })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch full broadcast rounds' })
  }
})

router.get('/broadcasts/round/:roundId/game/:gameId/pgn', async (req, res) => {
  try {
    const roundId = String(req.params.roundId || '').trim()
    const gameId = String(req.params.gameId || '').trim()
    if (!roundId || !gameId) {
      res.status(400).json({ success: false, error: 'Round id and game id are required' })
      return
    }

    const response = await fetchLichess(`https://lichess.org/study/${encodeURIComponent(roundId)}/${encodeURIComponent(gameId)}.pgn`, 'text/plain')
    const pgn = await response.text()

    res.json({
      success: true,
      data: {
        roundId,
        gameId,
        pgn
      }
    })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch broadcast game PGN' })
  }
})

router.get('/broadcasts/round/:roundId/streams', async (req, res) => {
  try {
    const roundId = String(req.params.roundId || '').trim()
    const gameId = String(req.query.gameId || '').trim()

    if (!roundId) {
      res.status(400).json({ success: false, error: 'Round id is required' })
      return
    }

    const pages = [
      `https://lichess.org/broadcast/-/-/${encodeURIComponent(roundId)}`
    ]

    if (gameId) {
      pages.push(`https://lichess.org/broadcast/-/-/${encodeURIComponent(roundId)}/${encodeURIComponent(gameId)}`)
    }

    const seen = new Set()
    const streams = []

    for (const url of pages) {
      try {
        const response = await fetchLichess(url, 'text/html')
        const html = await response.text()
        const parsed = extractBroadcastStreamsFromHtml(html)
        for (const stream of parsed) {
          const key = String(stream?.stream?.url || '')
          if (!key || seen.has(key)) continue
          seen.add(key)
          streams.push(stream)
        }
      } catch {
        // Ignore partial page failures and continue with other candidates.
      }
    }

    res.json({
      success: true,
      data: {
        roundId,
        gameId: gameId || null,
        streams
      }
    })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch broadcast streams' })
  }
})

router.get('/broadcasts/round/:roundId/game-streams', async (req, res) => {
  try {
    const roundId = String(req.params.roundId || '').trim()
    const maxGames = clampBroadcastGameScan(req.query.maxGames)

    if (!roundId) {
      res.status(400).json({ success: false, error: 'Round id is required' })
      return
    }

    const roundResponse = await fetchLichess(`https://lichess.org/api/broadcast/-/-/${encodeURIComponent(roundId)}`)
    const roundData = await roundResponse.json()
    const rawGames = Array.isArray(roundData?.games) ? roundData.games : []

    const prioritized = [
      ...rawGames.filter((g) => String(g?.status || '') === '*'),
      ...rawGames.filter((g) => String(g?.status || '') !== '*')
    ].slice(0, maxGames)

    const gameStreams = []
    for (const game of prioritized) {
      const gameId = String(game?.id || '').trim()
      if (!gameId) continue

      const pageUrl = `https://lichess.org/broadcast/-/-/${encodeURIComponent(roundId)}/${encodeURIComponent(gameId)}`
      let streams = []

      try {
        const response = await fetchLichess(pageUrl, 'text/html')
        const html = await response.text()
        streams = extractBroadcastStreamsFromHtml(html)
      } catch {
        streams = []
      }

      gameStreams.push({
        gameId,
        white: String(game?.players?.[0]?.name || 'White'),
        black: String(game?.players?.[1]?.name || 'Black'),
        ongoing: String(game?.status || '') === '*',
        streams
      })
    }

    res.json({
      success: true,
      data: {
        roundId,
        scanned: gameStreams.length,
        withStreams: gameStreams.filter((row) => Array.isArray(row.streams) && row.streams.length > 0).length,
        gameStreams
      }
    })
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'Failed to fetch per-game broadcast streams' })
  }
})

export default router
