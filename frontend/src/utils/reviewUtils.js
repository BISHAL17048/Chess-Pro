// ─── Classification metadata ───────────────────────────────────────────────────
// Exact labels + emojis as specified by user

export const CLASSIFICATION_META = {
  Book:         { emoji: '📖', color: '#94a3b8', squareBg: 'rgba(148,163,184,0.25)', textClass: 'text-slate-300',   borderClass: 'border-slate-400/40',   bgClass: 'bg-slate-500/15' },
  Genius:       { emoji: '💡', color: '#a855f7', squareBg: 'rgba(168,85,247,0.30)',  textClass: 'text-purple-300',  borderClass: 'border-purple-400/50',  bgClass: 'bg-purple-500/15' },
  Brilliant:    { emoji: '!!',  color: '#22d3ee', squareBg: 'rgba(34,211,238,0.28)',  textClass: 'text-cyan-300',    borderClass: 'border-cyan-400/50',    bgClass: 'bg-cyan-500/15' },
  Best:         { emoji: '⭐',  color: '#22c55e', squareBg: 'rgba(34,197,94,0.25)',   textClass: 'text-emerald-300', borderClass: 'border-emerald-400/45', bgClass: 'bg-emerald-500/15' },
  Outstanding:  { emoji: '💫', color: '#818cf8', squareBg: 'rgba(129,140,248,0.28)', textClass: 'text-indigo-300',  borderClass: 'border-indigo-400/45',  bgClass: 'bg-indigo-500/15' },
  Good:         { emoji: '✓',  color: '#6ee7b7', squareBg: 'rgba(110,231,183,0.22)', textClass: 'text-teal-300',    borderClass: 'border-teal-400/40',    bgClass: 'bg-teal-500/15' },
  Inaccuracy:   { emoji: '⚠️', color: '#facc15', squareBg: 'rgba(250,204,21,0.28)',  textClass: 'text-yellow-300',  borderClass: 'border-yellow-400/50',  bgClass: 'bg-yellow-500/15' },
  Mistake:      { emoji: '❓', color: '#f97316', squareBg: 'rgba(249,115,22,0.30)',  textClass: 'text-orange-300',  borderClass: 'border-orange-400/50',  bgClass: 'bg-orange-500/15' },
  Blunder:      { emoji: '❌', color: '#ef4444', squareBg: 'rgba(239,68,68,0.32)',   textClass: 'text-red-300',     borderClass: 'border-red-400/55',     bgClass: 'bg-red-500/15' },
  Miss:         { emoji: '✗',  color: '#f43f5e', squareBg: 'rgba(244,63,94,0.28)',   textClass: 'text-rose-300',    borderClass: 'border-rose-400/50',    bgClass: 'bg-rose-500/15' },
  'Missed Win': { emoji: '🏆', color: '#ef4444', squareBg: 'rgba(239,68,68,0.34)',  textClass: 'text-red-300',     borderClass: 'border-red-400/55',     bgClass: 'bg-red-500/15' },
}

export function getMeta(label) {
  return CLASSIFICATION_META[label] || CLASSIFICATION_META.Good
}

// Square background for board highlights
export function classificationSquareBg(label) {
  return getMeta(label).squareBg
}

// Returns inline style object for customSquareStyles
export function classificationSquareStyle(label) {
  const bg = classificationSquareBg(label)
  if (label === 'Blunder') {
    return {
      background: 'rgba(239,68,68,0.42)',
      boxShadow: 'inset 0 0 0 3px rgba(239,68,68,0.92), 0 0 16px rgba(239,68,68,0.35)'
    }
  }
  if (label === 'Mistake') {
    return {
      background: 'rgba(249,115,22,0.40)',
      boxShadow: 'inset 0 0 0 3px rgba(249,115,22,0.88), 0 0 14px rgba(249,115,22,0.30)'
    }
  }
  if (label === 'Inaccuracy') {
    return {
      background: 'rgba(250,204,21,0.36)',
      boxShadow: 'inset 0 0 0 3px rgba(250,204,21,0.84), 0 0 14px rgba(250,204,21,0.28)'
    }
  }
  if (label === 'Brilliant' || label === 'Genius') {
    return {
      background: 'rgba(56,189,248,0.34)',
      boxShadow: 'inset 0 0 0 3px rgba(56,189,248,0.88), 0 0 16px rgba(56,189,248,0.32)'
    }
  }
  return {
    background: bg,
    boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.42), 0 0 10px rgba(255,255,255,0.12)'
  }
}

// Check highlight (pulsing red — applied via CSS animation class externally)
export function checkSquareStyle() {
  return {
    background: 'rgba(239,68,68,0.45)',
    boxShadow: 'inset 0 0 0 3px rgba(239,68,68,0.85)',
    animation: 'pulse-check 1s ease-in-out infinite'
  }
}

// ─── Classification ────────────────────────────────────────────────────────────
export function evalToCentipawnsWhite(evaluation) {
  if (!evaluation) return 0
  if (evaluation.type === 'mate') {
    if (evaluation.value > 0) return 10000
    if (evaluation.value < 0) return -10000
    return 0
  }
  return Number(evaluation.value || 0)
}

export function formatEval(evaluation) {
  if (!evaluation) return '-'
  if (evaluation.type === 'mate') return `M${evaluation.value}`
  return (evaluation.value / 100).toFixed(2)
}

export function evalToWhitePercent(evaluation) {
  if (!evaluation) return 50
  if (evaluation.type === 'mate') {
    if (evaluation.value > 0) return 100
    if (evaluation.value < 0) return 0
    return 50
  }
  const clamped = Math.max(-1200, Math.min(1200, evaluation.value))
  return 50 + (clamped / 1200) * 50
}

export function classifyMove({ playedMoveUci, bestMoveUci, evalBefore, evalAfter, moveColor, ply = 999 }) {
  if (!playedMoveUci || !evalBefore || !evalAfter || !moveColor) {
    return { label: 'Good', lossCp: 0 }
  }

  const beforeCp = evalToCentipawnsWhite(evalBefore)
  const afterCp = evalToCentipawnsWhite(evalAfter)
  const beforeForMover = moveColor === 'w' ? beforeCp : -beforeCp
  const afterForMover  = moveColor === 'w' ? afterCp  : -afterCp
  const lossCp = Math.max(0, beforeForMover - afterForMover)
  const gainCp = afterForMover - beforeForMover
  const isBest = playedMoveUci === bestMoveUci

  // Book (opening)
  if (ply <= 16 && lossCp <= 18) return { label: 'Book', lossCp }

  // Missed Win: was decisively winning, now it isn't
  if (beforeForMover >= 300 && afterForMover <= 100 && lossCp >= 180) {
    return { label: 'Missed Win', lossCp }
  }

  if (isBest) {
    if (gainCp >= 260) return { label: 'Brilliant', lossCp }
    if (gainCp >= 140) return { label: 'Outstanding', lossCp }
    if (lossCp <= 5)   return { label: 'Brilliant', lossCp }
    return { label: 'Best', lossCp }
  }

  // Miss: played non-best but had a tactical shot
  if (!isBest && beforeForMover >= 150 && afterForMover < 0) {
    return { label: 'Miss', lossCp }
  }

  if (lossCp <= 35 && Math.abs(gainCp) >= 70) return { label: 'Good', lossCp }
  if (lossCp <= 60)  return { label: 'Good', lossCp }
  if (lossCp <= 120) return { label: 'Inaccuracy', lossCp }
  if (lossCp <= 250) return { label: 'Mistake', lossCp }
  return { label: 'Blunder', lossCp }
}

// Legacy compat: classificationClasses still available for older code
export function classificationClasses(label) {
  const m = getMeta(label)
  return `${m.bgClass} ${m.textClass} ${m.borderClass}`
}

export function openingNameFromMoves(rows = []) {
  const first = rows.slice(0, 8).map((row) => row.san)
  const key4 = first.slice(0, 4).join(' ')
  const key6 = first.slice(0, 6).join(' ')

  const map = {
    'e4 e5 Nf3 Nc6': 'Ruy Lopez / Italian setup',
    'e4 c5': 'Sicilian Defense',
    'e4 e6': 'French Defense',
    'e4 c6': 'Caro-Kann Defense',
    'd4 d5 c4': "Queen's Gambit",
    'd4 Nf6 c4 g6 Nc3 d5': 'Grunfeld Defense',
    'd4 Nf6 c4 e6 Nc3 Bb4': 'Nimzo-Indian Defense',
    'Nf3 d5 g3': "King's Fianchetto opening setup"
  }

  if (map[key6]) return map[key6]
  for (const [prefix, name] of Object.entries(map)) {
    if (key4.startsWith(prefix) || first.join(' ').startsWith(prefix)) return name
  }
  return 'Uncommon opening (transposition)'
}

export function estimateAccuracy(rows = [], color = 'w') {
  const ownRows = rows.filter((row) => row.color === color)
  if (!ownRows.length) return 0
  const totalLoss = ownRows.reduce((sum, row) => sum + (row.lossCp || 0), 0)
  const avgLoss = totalLoss / ownRows.length
  const accuracy = Math.max(35, Math.min(99, 100 - avgLoss * 0.11))
  return Number(accuracy.toFixed(1))
}

export function importantMoves(rows = [], limit = 8) {
  return rows
    .filter((row) => ['Brilliant', 'Genius', 'Inaccuracy', 'Mistake', 'Blunder', 'Miss', 'Missed Win'].includes(row.classification))
    .sort((a, b) => (b.lossCp || 0) - (a.lossCp || 0))
    .slice(0, limit)
}

export function gameResultFromFen(fen) {
  try {
    const sections = String(fen || '').split(' ')
    const turn = sections[1] || 'w'
    if (!fen) return '*'
    return turn === 'w' ? '0-1 or draw' : '1-0 or draw'
  } catch {
    return '*'
  }
}

// ─── Strength levels ───────────────────────────────────────────────────────────
export const STRENGTH_LEVELS = [
  { emoji: '🐣', label: 'Beginner',     skill: 1,  elo: 800  },
  { emoji: '🐢', label: 'Casual',       skill: 5,  elo: 1200 },
  { emoji: '🦊', label: 'Intermediate', skill: 10, elo: 1600 },
  { emoji: '🐴', label: 'Strong',       skill: 14, elo: 2000 },
  { emoji: '🐉', label: 'Master',       skill: 18, elo: 2400 },
  { emoji: '🤖', label: 'Maximum',      skill: 20, elo: 3200 },
]

// ─── Move feedback panel rows (chess.com style) ────────────────────────────────
export const FEEDBACK_ROWS = [
  { label: 'Brilliant',   emoji: '!!' },
  { label: 'Great',       emoji: '!' },
  { label: 'Best',        emoji: '⭐' },
  { label: 'Good',        emoji: '✓' },
  { label: 'Outstanding', emoji: '💫' },
  { label: 'Inaccuracy',  emoji: '⚠️' },
  { label: 'Mistake',     emoji: '❓' },
  { label: 'Miss',        emoji: '✗' },
  { label: 'Blunder',     emoji: '❌' },
  { label: 'Missed Win',  emoji: '🏆' },
]
