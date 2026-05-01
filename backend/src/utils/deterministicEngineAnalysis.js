import { Chess } from 'chess.js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const OPENINGS_DIR = path.resolve(__dirname, '../../chess-openings-master')
const OPENINGS_FILES = ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv']

let OPENING_BOOK_CACHE = null

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalizeSanToken(token) {
  const raw = String(token || '').trim()
  if (!raw) return ''
  return raw
    .replace(/[!?+#]+$/g, '')
    .replace(/\s+/g, '')
}

function parseOpeningPgnToSan(pgnLine) {
  const pgn = String(pgnLine || '').trim()
  if (!pgn) return []

  try {
    const game = new Chess()
    game.loadPgn(pgn, { strict: false })
    const history = game.history()
    if (history.length) {
      return history.map((san) => normalizeSanToken(san)).filter(Boolean)
    }
  } catch {
    // Fall back to token parsing below.
  }

  return pgn
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !/^\d+\.{1,3}$/.test(token))
    .filter((token) => !/^(1-0|0-1|1\/2-1\/2|\*)$/i.test(token))
    .map((token) => normalizeSanToken(token))
    .filter(Boolean)
}

function loadOpeningBookDatabase() {
  if (Array.isArray(OPENING_BOOK_CACHE)) {
    return OPENING_BOOK_CACHE
  }

  const rows = []

  for (const fileName of OPENINGS_FILES) {
    const fullPath = path.join(OPENINGS_DIR, fileName)
    const text = readFileSync(fullPath, 'utf8')
    const lines = text.split(/\r?\n/)

    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i]
      if (!line) continue

      const [ecoRaw, nameRaw, pgnRaw] = line.split('\t')
      const eco = String(ecoRaw || '').trim().toUpperCase()
      const name = String(nameRaw || '').trim()
      const pgn = String(pgnRaw || '').trim()
      if (!eco || !name || !pgn) continue

      const san = parseOpeningPgnToSan(pgn)
      if (!san.length) continue

      rows.push({ eco, name, pgn, san })
    }
  }

  OPENING_BOOK_CACHE = rows
  return rows
}

function resolveBookProgress(normalizedMoves, explicitBookMoves = []) {
  const openingBook = loadOpeningBookDatabase()
  const moveSans = normalizedMoves.map((m) => normalizeSanToken(m.san || m.move))
  const explicit = Array.isArray(explicitBookMoves)
    ? explicitBookMoves.map((x) => Boolean(x))
    : []

  let candidates = openingBook
  const isBookByPly = []

  for (let plyIndex = 0; plyIndex < moveSans.length; plyIndex += 1) {
    const san = moveSans[plyIndex]
    if (!san) {
      candidates = []
      isBookByPly.push(Boolean(explicit[plyIndex]))
      continue
    }

    candidates = candidates.filter((entry) => entry.san[plyIndex] === san)
    const inDbBook = candidates.length > 0
    isBookByPly.push(Boolean(explicit[plyIndex]) || inDbBook)
  }

  const lastBookPly = (() => {
    for (let i = isBookByPly.length - 1; i >= 0; i -= 1) {
      if (isBookByPly[i]) return i
    }
    return -1
  })()

  let opening = { name: 'Unknown Opening', eco: 'A00' }
  if (lastBookPly >= 0) {
    const matchedPlyCount = lastBookPly + 1
    const matchedCandidates = openingBook.filter((entry) => {
      for (let i = 0; i <= lastBookPly; i += 1) {
        if (entry.san[i] !== moveSans[i]) return false
      }
      return true
    })

    if (matchedCandidates.length) {
      const exactDepth = matchedCandidates.filter((entry) => entry.san.length === matchedPlyCount)
      const pool = exactDepth.length ? exactDepth : matchedCandidates

      pool.sort((a, b) => {
        if (a.san.length !== b.san.length) return a.san.length - b.san.length
        if (a.eco !== b.eco) return a.eco.localeCompare(b.eco)
        return a.name.localeCompare(b.name)
      })
      opening = {
        name: pool[0].name,
        eco: pool[0].eco
      }
    }
  }

  return {
    isBookByPly,
    opening
  }
}

function parseMateString(raw) {
  const text = String(raw || '').trim().toLowerCase()
  const m1 = text.match(/^m\s*([+-]?\d+)$/)
  if (m1) {
    const n = Number(m1[1])
    if (Number.isFinite(n) && n !== 0) return n > 0 ? 10000 : -10000
    return 0
  }

  const m2 = text.match(/^mate\s*in\s*([+-]?\d+)$/)
  if (m2) {
    const n = Number(m2[1])
    if (Number.isFinite(n) && n !== 0) return n > 0 ? 10000 : -10000
    return 0
  }

  const num = Number(text)
  if (Number.isFinite(num)) return Math.round(num)
  return null
}

function toCentipawnWhite(evaluation) {
  if (evaluation == null) return null

  if (typeof evaluation === 'number') {
    if (!Number.isFinite(evaluation)) return null
    return Math.round(evaluation)
  }

  if (typeof evaluation === 'string') {
    return parseMateString(evaluation)
  }

  if (typeof evaluation === 'object') {
    if (typeof evaluation.cp === 'number') {
      return Math.round(evaluation.cp)
    }

    if (typeof evaluation.mate === 'number') {
      if (evaluation.mate > 0) return 10000
      if (evaluation.mate < 0) return -10000
      return 0
    }

    if (evaluation.type === 'mate') {
      const value = Number(evaluation.value || 0)
      if (value > 0) return 10000
      if (value < 0) return -10000
      return 0
    }

    if (evaluation.type === 'cp') {
      const value = Number(evaluation.value || 0)
      if (!Number.isFinite(value)) return null
      return Math.round(value)
    }

    if (typeof evaluation.value === 'number') {
      return Math.round(evaluation.value)
    }

    if (typeof evaluation.value === 'string') {
      return parseMateString(evaluation.value)
    }
  }

  return null
}

function normalizeMovesList({ pgn, moves }) {
  const normalized = []

  if (Array.isArray(moves) && moves.length) {
    for (let i = 0; i < moves.length; i += 1) {
      const row = moves[i]
      if (typeof row === 'string') {
        normalized.push({
          ply: i + 1,
          move_number: Math.floor(i / 2) + 1,
          player: i % 2 === 0 ? 'white' : 'black',
          move: row,
          san: row
        })
        continue
      }

      if (row && typeof row === 'object') {
        const ply = Number(row.ply || row.moveIndex || i + 1)
        const isWhite = String(row.player || row.byColor || row.color || (ply % 2 === 1 ? 'white' : 'black')).toLowerCase().startsWith('w')
        normalized.push({
          ply,
          move_number: Number(row.move_number || row.moveNumber || Math.floor((ply + 1) / 2)),
          player: isWhite ? 'white' : 'black',
          move: String(row.move || row.san || row.uci || ''),
          san: String(row.san || row.move || row.uci || ''),
          playedMove: String(row.uci || row.playedMoveUci || row.moveUci || ''),
          source: row
        })
      }
    }
  }

  if (normalized.length) return normalized

  if (!pgn) return []

  try {
    const chess = new Chess()
    chess.loadPgn(String(pgn || ''))
    const history = chess.history({ verbose: true })
    return history.map((m, idx) => ({
      ply: idx + 1,
      move_number: Math.floor(idx / 2) + 1,
      player: idx % 2 === 0 ? 'white' : 'black',
      move: m.san,
      san: m.san,
      playedMove: `${m.from}${m.to}${m.promotion || ''}`,
      source: m
    }))
  } catch {
    return []
  }
}

function normalizeEvaluationTimeline(evaluations, movesCount) {
  if (!Array.isArray(evaluations) || evaluations.length === 0) {
    return { ok: false, reason: 'Missing evaluations array' }
  }

  // Case A: positional evals with one extra entry (before first move + after each move).
  if (evaluations.length >= movesCount + 1) {
    const timeline = []
    for (let i = 0; i < movesCount; i += 1) {
      const evalBefore = toCentipawnWhite(evaluations[i])
      const evalAfter = toCentipawnWhite(evaluations[i + 1])
      if (evalBefore == null || evalAfter == null) {
        return { ok: false, reason: `Invalid evaluation pair at ply ${i + 1}` }
      }
      timeline.push({
        evaluation_before: evalBefore,
        evaluation_after: evalAfter,
        source: evaluations[i + 1] && typeof evaluations[i + 1] === 'object' ? evaluations[i + 1] : null,
        sourceBefore: evaluations[i] && typeof evaluations[i] === 'object' ? evaluations[i] : null
      })
    }
    return { ok: true, timeline }
  }

  // Case B: move-wise objects that already include before/after values.
  if (evaluations.length >= movesCount) {
    const timeline = []
    for (let i = 0; i < movesCount; i += 1) {
      const row = evaluations[i]
      if (!row || typeof row !== 'object') {
        return { ok: false, reason: `Expected object evaluation row at ply ${i + 1}` }
      }

      const beforeRaw = row.evaluation_before ?? row.eval_before ?? row.evalBefore ?? row.before ?? row.pre
      const afterRaw = row.evaluation_after ?? row.eval_after ?? row.evalAfter ?? row.after ?? row.post
      const evalBefore = toCentipawnWhite(beforeRaw)
      const evalAfter = toCentipawnWhite(afterRaw)

      if (evalBefore == null || evalAfter == null) {
        return { ok: false, reason: `Invalid move evaluation at ply ${i + 1}` }
      }

      timeline.push({
        evaluation_before: evalBefore,
        evaluation_after: evalAfter,
        source: row,
        sourceBefore: row
      })
    }
    return { ok: true, timeline }
  }

  return { ok: false, reason: 'Evaluations length does not match moves list' }
}

function resolveOpening({ pgn, normalizedMoves }) {
  const text = String(pgn || '')
  const ecoTag = text.match(/\[ECO\s+"([A-E][0-9]{2})"\]/i)
  const openingTag = text.match(/\[Opening\s+"([^"]+)"\]/i)

  if (ecoTag) {
    return {
      name: openingTag?.[1] || 'Unknown Opening',
      eco: ecoTag[1].toUpperCase()
    }
  }

  const matched = resolveBookProgress(normalizedMoves, [])
  return matched.opening
}

function computeCpl(player, evalBefore, evalAfter) {
  let cpl = 0
  if (player === 'white') {
    cpl = evalBefore - evalAfter
  } else {
    cpl = evalAfter - evalBefore
  }
  return clamp(Math.max(0, cpl), 0, 1000)
}

function classifyByThreshold(cpl) {
  if (cpl <= 10) return 'Best'
  if (cpl <= 30) return 'Excellent'
  if (cpl <= 60) return 'Good'
  if (cpl <= 100) return 'Inaccuracy'
  if (cpl <= 300) return 'Mistake'
  return 'Blunder'
}

function resolveEngineBestMove(moveRow, evalRow) {
  const fromMove = moveRow?.source || {}
  const fromEval = evalRow?.source || {}

  return String(
    fromMove.best_move
    || fromMove.bestMove
    || fromMove.bestMoveUci
    || fromEval.best_move
    || fromEval.bestMove
    || fromEval.bestMoveUci
    || ''
  ).trim() || null
}

function isEngineBestMove(moveRow, bestMove) {
  const fromMove = moveRow?.source || {}
  const played = String(moveRow?.playedMove || fromMove.playedMoveUci || fromMove.moveUci || fromMove.uci || '').trim().toLowerCase()
  if (!played || !bestMove) return false
  return played === String(bestMove).trim().toLowerCase()
}

function hasSacrificeHint(moveRow, evalRow) {
  const moveSource = moveRow?.source || {}
  const evalSource = evalRow?.source || {}

  const numericHint = Number(
    moveSource.materialSacrificeCp
    ?? moveSource.sacrificeCp
    ?? evalSource.materialSacrificeCp
    ?? evalSource.sacrificeCp
    ?? 0
  )

  if (Number.isFinite(numericHint) && numericHint > 0) return true

  if (moveSource.materialSacrifice === true || evalSource.materialSacrifice === true) return true
  if (moveSource.sacrifice === true || evalSource.sacrifice === true) return true

  return false
}

function alternativeGapCp(moveRow, evalRow) {
  const moveSource = moveRow?.source || {}
  const evalSource = evalRow?.source || {}
  const value = Number(
    moveSource.alternativeGapCp
    ?? moveSource.altGapCp
    ?? moveSource.bestVsSecondCp
    ?? evalSource.alternativeGapCp
    ?? evalSource.altGapCp
    ?? evalSource.bestVsSecondCp
    ?? 0
  )

  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

function computeAccuracy(moves, player) {
  const own = moves.filter((m) => m.player === player)
  if (!own.length) return 0

  const avgCpl = own.reduce((sum, row) => sum + row.cpl, 0) / own.length
  const raw = 100 - (avgCpl / 10)
  return Number(clamp(raw, 0, 100).toFixed(2))
}

function summarize({ opening, moves, accuracy, keyMoments, result }) {
  const firstMistake = keyMoments.find((x) => x.type === 'First Mistake')
  const firstBlunder = keyMoments.find((x) => x.type === 'First Blunder')
  const biggestSwing = keyMoments.find((x) => x.type === 'Biggest Swing')

  const better = accuracy.white > accuracy.black
    ? 'White'
    : accuracy.black > accuracy.white
      ? 'Black'
      : 'Both sides'

  const s1 = `The game followed ${opening.name} (${opening.eco}).`
  const s2 = firstBlunder
    ? `The first major turning point was move ${firstBlunder.move_number} when ${firstBlunder.player} made the first blunder.`
    : firstMistake
      ? `The first turning point was move ${firstMistake.move_number} when ${firstMistake.player} made the first mistake.`
      : 'No large early mistakes were detected by centipawn-loss thresholds.'
  const s3 = biggestSwing
    ? `The biggest evaluation swing happened on move ${biggestSwing.move_number}.`
    : 'No significant evaluation swing was detected.'
  const s4 = `${better} performed better by average CPL (White ${accuracy.white}, Black ${accuracy.black}).`
  const s5 = `The result was driven by move quality measured from the provided engine evaluations${result ? `, ending as ${result}` : ''}.`

  return [s1, s2, s3, s4, s5].slice(0, 5).join(' ')
}

export function analyzeDeterministicEngineData(payload = {}) {
  const pgn = payload?.pgn || payload?.PGN || ''
  const movesInput = payload?.moves ?? payload?.Moves ?? payload?.movesList ?? []
  const evaluationsInput = payload?.evaluations ?? payload?.EngineEvaluations ?? []
  const explicitBookMoves = payload?.book_moves ?? payload?.bookMoves ?? []
  const result = String(payload?.result || '').trim()

  const normalizedMoves = normalizeMovesList({ pgn, moves: movesInput })
  if (!normalizedMoves.length) {
    throw new Error('Unable to parse moves list from input PGN/moves')
  }

  const evalTimelineResult = normalizeEvaluationTimeline(evaluationsInput, normalizedMoves.length)
  if (!evalTimelineResult.ok) {
    throw new Error(evalTimelineResult.reason || 'Invalid evaluations')
  }

  const openingFromTags = resolveOpening({ pgn, normalizedMoves })
  const bookProgress = resolveBookProgress(normalizedMoves, explicitBookMoves)
  const opening = openingFromTags.name !== 'Unknown Opening'
    ? openingFromTags
    : bookProgress.opening
  const moves = []
  const keyMoments = []

  let firstMistake = null
  let firstBlunder = null
  let biggestSwing = null

  for (let i = 0; i < normalizedMoves.length; i += 1) {
    const moveRow = normalizedMoves[i]
    const evalRow = evalTimelineResult.timeline[i]

    const evalBefore = evalRow.evaluation_before
    const evalAfter = evalRow.evaluation_after
    const cpl = computeCpl(moveRow.player, evalBefore, evalAfter)
    const isBookMove = Boolean(bookProgress.isBookByPly[i])

    let classification = classifyByThreshold(cpl)
    const bestMove = resolveEngineBestMove(moveRow, evalRow)
    const isBest = isEngineBestMove(moveRow, bestMove)

    if (cpl <= 10 && isBest && hasSacrificeHint(moveRow, evalRow)) {
      const noWorsen = moveRow.player === 'white'
        ? evalAfter >= evalBefore
        : evalAfter <= evalBefore
      if (noWorsen) {
        classification = 'Brilliant'
      }
    }

    if (classification !== 'Brilliant' && cpl <= 20 && alternativeGapCp(moveRow, evalRow) >= 50) {
      classification = 'Great'
    }

    if (isBookMove) {
      classification = 'Book'
    }

    let comment = ''
    let bestMoveField = null
    if (isBookMove) {
      bestMoveField = bestMove
      comment = bestMove
        ? `Book move found in opening database; Stockfish also suggests ${bestMove}.`
        : 'Book move found in opening database; Stockfish evaluation still calculated.'
    } else if (cpl > 10) {
      bestMoveField = bestMove
      comment = bestMove
        ? `Engine preferred ${bestMove} to reduce centipawn loss.`
        : 'Engine best move was not provided in the input data.'
    }

    const row = {
      move_number: moveRow.move_number,
      player: moveRow.player,
      move: moveRow.move,
      evaluation_before: evalBefore,
      evaluation_after: evalAfter,
      cpl,
      classification,
      is_book_move: isBookMove,
      best_move: bestMoveField,
      comment
    }
    moves.push(row)

    if (!firstMistake && cpl >= 100) {
      firstMistake = {
        move_number: row.move_number,
        type: 'First Mistake',
        player: row.player,
        description: `${row.player} first reached mistake threshold on ${row.move}.`
      }
    }

    if (!firstBlunder && cpl >= 300) {
      firstBlunder = {
        move_number: row.move_number,
        type: 'First Blunder',
        player: row.player,
        description: `${row.player} first reached blunder threshold on ${row.move}.`
      }
    }

    const swing = Math.abs(evalAfter - evalBefore)
    if (!biggestSwing || swing > biggestSwing.swing) {
      biggestSwing = {
        move_number: row.move_number,
        type: 'Biggest Swing',
        player: row.player,
        swing,
        description: `${row.move} changed evaluation by ${swing} centipawns.`
      }
    }

    if (row.player === 'white') {
      const isMissedWin = evalBefore >= 300 && evalAfter <= (evalBefore - 150)
      if (isMissedWin) {
        keyMoments.push({
          move_number: row.move_number,
          type: 'Missed Win',
          player: row.player,
          description: `White dropped a winning edge on ${row.move}.`
        })
      }
    } else {
      const isMissedWin = evalBefore <= -300 && evalAfter >= (evalBefore + 150)
      if (isMissedWin) {
        keyMoments.push({
          move_number: row.move_number,
          type: 'Missed Win',
          player: row.player,
          description: `Black dropped a winning edge on ${row.move}.`
        })
      }
    }
  }

  if (firstMistake) keyMoments.unshift(firstMistake)
  if (firstBlunder) keyMoments.push(firstBlunder)
  if (biggestSwing) {
    keyMoments.push({
      move_number: biggestSwing.move_number,
      type: biggestSwing.type,
      player: biggestSwing.player,
      description: biggestSwing.description
    })
  }

  const accuracy = {
    white: computeAccuracy(moves, 'white'),
    black: computeAccuracy(moves, 'black')
  }

  const summary = summarize({
    opening,
    moves,
    accuracy,
    keyMoments,
    result
  })

  return {
    opening,
    moves,
    accuracy,
    key_moments: keyMoments,
    summary
  }
}
