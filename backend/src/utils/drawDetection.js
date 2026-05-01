function normalizeRepetitionCountMap(input) {
  if (!input || typeof input !== 'object') return {}
  return Object.entries(input).reduce((acc, [fen, count]) => {
    const key = String(fen || '').trim()
    const value = Number(count || 0)
    if (!key || !Number.isFinite(value) || value <= 0) return acc
    acc[key] = value
    return acc
  }, {})
}

function normalizeMaterialState(input) {
  const makeSide = (side) => ({
    k: Number(side?.k || 0),
    q: Number(side?.q || 0),
    r: Number(side?.r || 0),
    b: Number(side?.b || 0),
    n: Number(side?.n || 0),
    p: Number(side?.p || 0)
  })

  return {
    white: makeSide(input?.white),
    black: makeSide(input?.black)
  }
}

function sideIsInsufficient(side) {
  const queens = side.q
  const rooks = side.r
  const pawns = side.p
  const bishops = side.b
  const knights = side.n

  if (queens > 0 || rooks > 0 || pawns > 0) return false

  const minorCount = bishops + knights
  if (minorCount === 0) return true
  if (minorCount === 1 && (bishops === 1 || knights === 1)) return true

  return false
}

function noPossibleCheckmate(materialState) {
  const whiteInsufficient = sideIsInsufficient(materialState.white)
  const blackInsufficient = sideIsInsufficient(materialState.black)

  // Rule set requested by user prompt: only basic guaranteed-insufficient cases.
  const whiteOnlyMinor = materialState.white.q === 0
    && materialState.white.r === 0
    && materialState.white.p === 0
    && (materialState.white.b + materialState.white.n) <= 1

  const blackOnlyMinor = materialState.black.q === 0
    && materialState.black.r === 0
    && materialState.black.p === 0
    && (materialState.black.b + materialState.black.n) <= 1

  return whiteInsufficient && blackInsufficient && whiteOnlyMinor && blackOnlyMinor
}

export function evaluateDeterministicDrawState({
  moves = [],
  fenHistory = [],
  metadata = {},
  isStalemate = false,
  isKingInCheck = false
} = {}) {
  const safeHalfmoveClock = Number(metadata?.halfmove_clock || 0)
  const repetitionCount = normalizeRepetitionCountMap(metadata?.repetition_count)
  const materialState = normalizeMaterialState(metadata?.material_state)
  const timeoutFlag = Boolean(metadata?.timeout_flag)
  const drawAgreed = Boolean(metadata?.draw_agreed)
  const timeoutLoser = String(metadata?.timeout_loser || '').toLowerCase()

  // 1) Stalemate
  if (Boolean(isStalemate) && !Boolean(isKingInCheck)) {
    return {
      is_draw: true,
      type: 'Stalemate',
      automatic: true,
      description: 'Player has no legal moves and is not in check.'
    }
  }

  // 2) Insufficient Material
  if (noPossibleCheckmate(materialState)) {
    return {
      is_draw: true,
      type: 'Insufficient Material',
      automatic: true
    }
  }

  // 3) Fivefold Repetition
  if (Object.values(repetitionCount).some((count) => Number(count) >= 5)) {
    return {
      is_draw: true,
      type: 'Fivefold Repetition',
      automatic: true
    }
  }

  // 4) Threefold Repetition
  if (Object.values(repetitionCount).some((count) => Number(count) >= 3)) {
    return {
      is_draw: true,
      type: 'Threefold Repetition',
      automatic: false
    }
  }

  // 5) 75-Move Rule
  if (Number.isFinite(safeHalfmoveClock) && safeHalfmoveClock >= 150) {
    return {
      is_draw: true,
      type: '75-Move Rule',
      automatic: true
    }
  }

  // 6) 50-Move Rule
  if (Number.isFinite(safeHalfmoveClock) && safeHalfmoveClock >= 100) {
    return {
      is_draw: true,
      type: '50-Move Rule',
      automatic: false
    }
  }

  // 7) Timeout with No Mating Material
  if (timeoutFlag && (timeoutLoser === 'white' || timeoutLoser === 'black')) {
    const opponent = timeoutLoser === 'white' ? materialState.black : materialState.white
    if (sideIsInsufficient(opponent)) {
      return {
        is_draw: true,
        type: 'Timeout vs Insufficient Material',
        automatic: true
      }
    }
  }

  // 8) Draw by Agreement
  if (drawAgreed) {
    return {
      is_draw: true,
      type: 'Agreement',
      automatic: false
    }
  }

  return {
    is_draw: false,
    type: null
  }
}
