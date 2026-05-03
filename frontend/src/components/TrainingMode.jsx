import { useEffect, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { useStockfish } from '../hooks/useStockfish'
import { useSoundEffects } from '../hooks/useSoundEffects'
import { BOARD_THEMES, useBoardThemeStore } from '../store/useBoardThemeStore'
import { fetchProgressOverview, recordPuzzleAttempt } from '../utils/progressApi'

function isBoardSquare(square) {
  return typeof square === 'string' && /^[a-h][1-8]$/.test(square)
}

const DIFFICULTY_OPTIONS = [
  { value: 'easiest', label: 'Easiest' },
  { value: 'easier', label: 'Easier' },
  { value: 'normal', label: 'Normal' },
  { value: 'harder', label: 'Harder' },
  { value: 'hardest', label: 'Hardest' }
]

const COLOR_OPTIONS = [
  { value: '', label: 'Auto' },
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' }
]

const PUZZLE_THEME_GROUPS = [
  {
    label: 'Core',
    options: [
      { value: 'mix', label: 'Mix (All Themes)' },
      { value: 'opening', label: 'Opening' },
      { value: 'middlegame', label: 'Middlegame' },
      { value: 'endgame', label: 'Endgame' }
    ]
  },
  {
    label: 'Mates',
    options: [
      { value: 'mate', label: 'Mate Patterns' },
      { value: 'mateIn1', label: 'Mate in 1' },
      { value: 'mateIn2', label: 'Mate in 2' },
      { value: 'mateIn3', label: 'Mate in 3' }
    ]
  },
  {
    label: 'Tactics',
    options: [
      { value: 'fork', label: 'Fork' },
      { value: 'pin', label: 'Pin' },
      { value: 'skewer', label: 'Skewer' },
      { value: 'doubleCheck', label: 'Double Check' },
      { value: 'discoveredAttack', label: 'Discovered Attack' },
      { value: 'xRayAttack', label: 'X-Ray Attack' },
      { value: 'clearance', label: 'Clearance' },
      { value: 'deflection', label: 'Deflection' },
      { value: 'attraction', label: 'Attraction' },
      { value: 'interference', label: 'Interference' },
      { value: 'sacrifice', label: 'Sacrifice' },
      { value: 'quietMove', label: 'Quiet Move' }
    ]
  },
  {
    label: 'Positional and Endings',
    options: [
      { value: 'hangingPiece', label: 'Hanging Piece' },
      { value: 'trappedPiece', label: 'Trapped Piece' },
      { value: 'advancedPawn', label: 'Advanced Pawn' },
      { value: 'kingsideAttack', label: 'Kingside Attack' },
      { value: 'queensideAttack', label: 'Queenside Attack' },
      { value: 'rookEndgame', label: 'Rook Endgame' },
      { value: 'pawnEndgame', label: 'Pawn Endgame' }
    ]
  }
]

const BATCH_SIZE_OPTIONS = [10, 15, 20, 30, 40, 50]

const LOCAL_FALLBACK_PUZZLES = [
  {
    puzzle: {
      id: 'local-001',
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      initialPly: 0,
      rating: 900,
      plays: 0,
      themes: ['opening', 'mix'],
      solution: ['f1b5']
    },
    game: {
      perf: { name: 'Practice' },
      players: [{ color: 'white', name: 'White' }, { color: 'black', name: 'Black' }]
    }
  },
  {
    puzzle: {
      id: 'local-002',
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1',
      initialPly: 0,
      rating: 950,
      plays: 0,
      themes: ['center', 'mix'],
      solution: ['e5d4']
    },
    game: {
      perf: { name: 'Practice' },
      players: [{ color: 'white', name: 'White' }, { color: 'black', name: 'Black' }]
    }
  },
  {
    puzzle: {
      id: 'local-003',
      fen: '6k1/5ppp/8/8/8/6Q1/5PPP/6K1 w - - 0 1',
      initialPly: 0,
      rating: 1000,
      plays: 0,
      themes: ['mate', 'endgame'],
      solution: ['g3b8']
    },
    game: {
      perf: { name: 'Practice' },
      players: [{ color: 'white', name: 'White' }, { color: 'black', name: 'Black' }]
    }
  }
]

function TrainingMode() {
  const themeId = useBoardThemeStore((state) => state.themeId)
  const boardTheme = useMemo(() => BOARD_THEMES.find((theme) => theme.id === themeId) || BOARD_THEMES[0], [themeId])

  const [themeAngle, setThemeAngle] = useState('mix')
  const [difficulty, setDifficulty] = useState('normal')
  const [forcedColor, setForcedColor] = useState('')
  const [batchSize, setBatchSize] = useState(20)

  const [selectedSquare, setSelectedSquare] = useState(null)
  const [legalMoves, setLegalMoves] = useState([])
  const [lastMove, setLastMove] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')

  const [puzzleSource, setPuzzleSource] = useState('')
  const [puzzleMeta, setPuzzleMeta] = useState(null)
  const [puzzleLoading, setPuzzleLoading] = useState(false)
  const [puzzleError, setPuzzleError] = useState('')
  const [solutionPly, setSolutionPly] = useState(0)

  const [batchLoading, setBatchLoading] = useState(false)
  const [batchError, setBatchError] = useState('')
  const [batchPuzzles, setBatchPuzzles] = useState([])
  const [activeBatchIndex, setActiveBatchIndex] = useState(-1)
  const [solvedCount, setSolvedCount] = useState(0)
  const [mistakeCount, setMistakeCount] = useState(0)
  const [fallbackCursor, setFallbackCursor] = useState(0)

  const [game, setGame] = useState(() => new Chess())
  const [boardWidth, setBoardWidth] = useState(560)
  const boardFrameRef = useRef(null)
  const wrongMoveResetTimeoutRef = useRef(null)
  const { unlockAudio, playMove, playCapture, playCastle, playCheck, playPromotion, playIllegal, playGameEnd } = useSoundEffects()

  const { ready, isAnalyzing, bestMove, evaluation, analyzeFen } = useStockfish()
  const fen = game.fen()
  const sideToMove = game.turn() === 'w' ? 'white' : 'black'
  const boardOrientation = puzzleMeta?.playerColor || sideToMove

  const normalizedEvaluation = useMemo(() => {
    if (!evaluation) return null
    const sideToMove = String(fen || '').split(' ')[1] || 'w'
    const stmSign = sideToMove === 'w' ? 1 : -1

    if (evaluation.type === 'cp') {
      return {
        ...evaluation,
        type: 'cp',
        value: Math.round(Number(evaluation.value || 0) * stmSign)
      }
    }

    if (evaluation.type === 'mate') {
      return {
        ...evaluation,
        type: 'mate',
        value: Math.round(Number(evaluation.value || 0) * stmSign)
      }
    }

    return null
  }, [evaluation, fen])

  const stockfishEvalLabel = useMemo(() => {
    if (!normalizedEvaluation) return '-'
    if (normalizedEvaluation.type === 'mate') {
      const mateMoves = Math.max(1, Math.abs(Number(normalizedEvaluation.value || 0)))
      return normalizedEvaluation.value > 0 ? `#${mateMoves}` : `-#${mateMoves}`
    }

    const pawns = Number(normalizedEvaluation.value || 0) / 100
    return `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`
  }, [normalizedEvaluation])

  const nextPuzzleMove = puzzleMeta?.solution?.[solutionPly] || null
  const solutionLength = Array.isArray(puzzleMeta?.solution) ? puzzleMeta.solution.length : 0
  const progress = solutionLength ? Math.min(100, Math.round((solutionPly / solutionLength) * 100)) : 0

  const statusClass = useMemo(() => {
    if (!statusMessage) return 'text-slate-300'
    if (statusMessage.toLowerCase().includes('not')) return 'text-red-300'
    if (statusMessage.toLowerCase().includes('solved')) return 'text-emerald-300'
    return 'text-cyan-300'
  }, [statusMessage])

  const clearSelection = () => {
    setSelectedSquare(null)
    setLegalMoves([])
  }

  const applyUciMove = (chess, uci) => {
    const raw = String(uci || '').trim()
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(raw)) return null

    return chess.move({
      from: raw.slice(0, 2),
      to: raw.slice(2, 4),
      promotion: raw.length > 4 ? raw[4] : undefined
    })
  }

  const rebuildPuzzlePosition = (meta, uptoPly = 0) => {
    const baseFen = String(meta?.startFen || meta?.fen || '').trim()
    if (!baseFen) return null

    const replay = new Chess(baseFen)
    const line = Array.isArray(meta?.solution) ? meta.solution : []
    const capped = Math.max(0, Math.min(Number(uptoPly || 0), line.length))

    for (let i = 0; i < capped; i += 1) {
      const move = applyUciMove(replay, line[i])
      if (!move) break
    }

    return replay
  }

  const buildArrowFromUci = (uci) => {
    const raw = String(uci || '').trim().toLowerCase()
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(raw)) return null
    return [raw.slice(0, 2), raw.slice(2, 4)]
  }

  const boardHintArrows = useMemo(() => {
    const arrows = []
    const puzzleArrow = buildArrowFromUci(nextPuzzleMove)
    const engineArrow = buildArrowFromUci(bestMove)

    if (puzzleArrow) {
      arrows.push(puzzleArrow)
    }

    if (
      engineArrow &&
      (!puzzleArrow || engineArrow[0] !== puzzleArrow[0] || engineArrow[1] !== puzzleArrow[1])
    ) {
      arrows.push(engineArrow)
    }

    return arrows
  }, [nextPuzzleMove, bestMove])

  const extractPlayerName = (gameData, color) => {
    const players = Array.isArray(gameData?.players) ? gameData.players : []
    const player = players.find((entry) => entry?.color === color)
    if (!player) return color === 'white' ? 'White' : 'Black'
    const title = player?.title ? `${player.title} ` : ''
    return `${title}${player?.name || (color === 'white' ? 'White' : 'Black')}`.trim()
  }

  const toMoveLabel = (turn) => (turn === 'w' ? 'White' : 'Black')

  const parseUciMove = (uci) => {
    const text = String(uci || '').trim()
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(text)) return null
    return {
      from: text.slice(0, 2),
      to: text.slice(2, 4)
    }
  }

  const tokenizeLoosePgnMoves = (pgnText) => {
    const clean = String(pgnText || '')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\$\d+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!clean) return []

    const rawTokens = clean.split(' ').map((token) => token.trim()).filter(Boolean)
    const resultTokens = new Set(['1-0', '0-1', '1/2-1/2', '*'])
    const moves = []

    for (const token of rawTokens) {
      if (!token) continue
      if (resultTokens.has(token)) continue

      // Support tokens like "12.", "12...", and "12...Qh4+".
      let normalized = token.replace(/^\d+\.(\.\.)?/, '')
      if (!normalized) continue

      // Remove move quality suffixes while keeping SAN checks/mates.
      normalized = normalized.replace(/[!?]+/g, '')
      if (!normalized || resultTokens.has(normalized)) continue

      moves.push(normalized)
    }

    return moves
  }

  const buildStateFromPgn = (pgn, plyCount) => {
    const text = String(pgn || '').trim()
    if (!text) return null

    const setup = new Chess()
    let applied = 0

    const fullGame = new Chess()
    let parsedFullMoves = []
    try {
      fullGame.loadPgn(text, { strict: false })
      parsedFullMoves = fullGame.history({ verbose: true })
    } catch {
      parsedFullMoves = []
    }

    if (parsedFullMoves.length) {
      const count = Math.max(0, Math.min(Number(plyCount || 0), parsedFullMoves.length))
      for (let i = 0; i < count; i += 1) {
        const move = parsedFullMoves[i]
        const ok = setup.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' })
        if (!ok) break
        applied += 1
      }
    } else {
      const looseMoves = tokenizeLoosePgnMoves(text)
      const count = Math.max(0, Math.min(Number(plyCount || 0), looseMoves.length))
      for (let i = 0; i < count; i += 1) {
        const san = looseMoves[i]
        let ok = null
        try {
          ok = setup.move(san, { sloppy: true })
        } catch {
          ok = null
        }

        if (!ok) break
        applied += 1
      }
    }

    const history = setup.history({ verbose: true })
    const last = history.length ? history[history.length - 1] : null
    return {
      game: setup,
      lastMove: last ? { from: last.from, to: last.to } : null,
      moveCount: applied
    }
  }

  const canPlayFirstSolutionMove = (candidate, firstSolutionUci) => {
    if (!candidate || !firstSolutionUci) return true
    const probe = new Chess(candidate.fen())
    return Boolean(applyUciMove(probe, firstSolutionUci))
  }

  const resolvePuzzleSetup = (payload) => {
    const pgn = String(payload?.game?.pgn || '').trim()
    const puzzleFen = String(payload?.puzzle?.fen || '').trim()
    const initialPly = Number(payload?.puzzle?.initialPly || 0)
    const solution = Array.isArray(payload?.puzzle?.solution) ? payload.puzzle.solution : []
    const firstSolution = solution[0] || null
    const lastUci = parseUciMove(payload?.puzzle?.lastMove)

    const candidates = []

    if (puzzleFen) {
      try {
        const fromFen = new Chess(puzzleFen)
        candidates.push({
          game: fromFen,
          lastMove: lastUci ? { from: lastUci.from, to: lastUci.to } : null,
          source: 'fen'
        })
      } catch {
        // Ignore malformed FEN and continue with PGN-derived candidates.
      }
    }

    if (pgn) {
      const pgnAtInitial = buildStateFromPgn(pgn, initialPly)
      if (pgnAtInitial?.game) {
        candidates.push({
          game: pgnAtInitial.game,
          lastMove: pgnAtInitial.lastMove,
          source: 'pgn-initial'
        })

        if (lastUci) {
          const withLastMove = new Chess(pgnAtInitial.game.fen())
          const applied = withLastMove.move({
            from: lastUci.from,
            to: lastUci.to,
            promotion: String(payload?.puzzle?.lastMove || '').length === 5 ? String(payload.puzzle.lastMove).slice(4).toLowerCase() : 'q'
          })

          if (applied) {
            candidates.push({
              game: withLastMove,
              lastMove: { from: applied.from, to: applied.to },
              source: 'pgn-initial-plus-last'
            })
          }
        }
      }

      const pgnAtInitialPlusOne = buildStateFromPgn(pgn, initialPly + 1)
      if (pgnAtInitialPlusOne?.game) {
        candidates.push({
          game: pgnAtInitialPlusOne.game,
          lastMove: pgnAtInitialPlusOne.lastMove,
          source: 'pgn-initial-plus-one'
        })
      }
    }

    const best = candidates.find((entry) => canPlayFirstSolutionMove(entry.game, firstSolution)) || candidates[0] || null
    if (!best?.game) {
      throw new Error('Puzzle data is missing valid setup state')
    }

    return {
      setupGame: best.game,
      previousMove: best.lastMove,
      source: best.source
    }
  }

  const hydratePuzzle = (payload, sourceLabel) => {
    const { setupGame, previousMove, source } = resolvePuzzleSetup(payload)

    setGame(new Chess(setupGame.fen()))
    setLastMove(previousMove ? { from: previousMove.from, to: previousMove.to } : null)
    clearSelection()
    setSolutionPly(0)
    setStatusMessage('')
    setPuzzleError('')
    setPuzzleSource(source ? `${sourceLabel} • ${source}` : sourceLabel)

    setPuzzleMeta({
      id: payload?.puzzle?.id || null,
      startFen: setupGame.fen(),
      playerColor: setupGame.turn() === 'w' ? 'white' : 'black',
      rating: payload?.puzzle?.rating || null,
      plays: payload?.puzzle?.plays || null,
      themes: Array.isArray(payload?.puzzle?.themes) ? payload.puzzle.themes : [],
      solution: Array.isArray(payload?.puzzle?.solution) ? payload.puzzle.solution : [],
      perf: payload?.game?.perf?.name || '-',
      white: extractPlayerName(payload?.game, 'white'),
      black: extractPlayerName(payload?.game, 'black'),
      toMove: toMoveLabel(setupGame.turn())
    })
  }

  const mergeUniquePuzzles = (existing, incoming) => {
    const seen = new Set()
    const merged = []

    for (const item of [...existing, ...incoming]) {
      const id = item?.puzzle?.id
      if (!id || seen.has(id)) continue
      seen.add(id)
      merged.push(item)
    }

    return merged
  }

  const selectSquare = (square) => {
    const canonical = rebuildPuzzlePosition(puzzleMeta, solutionPly) || game
    const piece = canonical.get(square)
    if (!piece) {
      clearSelection()
      return
    }

    if (piece.color !== canonical.turn()) {
      setStatusMessage(`It is ${toMoveLabel(canonical.turn())} to move.`)
      clearSelection()
      return
    }

    setSelectedSquare(square)
    setLegalMoves(canonical.moves({ square, verbose: true }).map((move) => move.to))
  }

  const loadLichessDaily = async () => {
    setPuzzleLoading(true)
    setPuzzleError('')

    try {
      // Use a local daily fallback puzzle
      const idx = fallbackCursor % LOCAL_FALLBACK_PUZZLES.length
      const data = LOCAL_FALLBACK_PUZZLES[idx]
      hydratePuzzle(data, 'Daily Puzzle')
    } catch (e) {
      setPuzzleError(e?.message || 'Daily puzzle source unavailable.')
    } finally {
      setPuzzleLoading(false)
    }
  }

  const loadRandomPuzzle = async () => {
    setPuzzleLoading(true)
    setPuzzleError('')

    try {
      const data = LOCAL_FALLBACK_PUZZLES[Math.floor(Math.random() * LOCAL_FALLBACK_PUZZLES.length)]
      hydratePuzzle(data, `Random • ${themeAngle}`)
    } catch (e) {
      setPuzzleError(e?.message || 'Failed to load random puzzle.')
    } finally {
      setPuzzleLoading(false)
    }
  }

  const loadBatchPuzzles = async (append = false) => {
    setBatchLoading(true)
    setBatchError('')

    try {
      // Create a batch by repeating/shuffling local puzzles
      const nb = Math.max(1, Math.min(200, Number(batchSize || 20)))
      const items = []
      for (let i = 0; i < nb; i += 1) {
        const src = LOCAL_FALLBACK_PUZZLES[i % LOCAL_FALLBACK_PUZZLES.length]
        items.push({ ...src, puzzle: { ...src.puzzle, id: `${src.puzzle.id}-${i}` } })
      }

      const incoming = items
      if (!incoming.length) {
        setBatchError('No puzzles returned for this filter. Try another theme or difficulty.')
        if (!append) {
          setBatchPuzzles([])
          setActiveBatchIndex(-1)
        }
        return
      }

      let resolvedList = incoming
      setBatchPuzzles((prev) => {
        resolvedList = append ? mergeUniquePuzzles(prev, incoming) : incoming
        return resolvedList
      })

      const nextIndex = append && activeBatchIndex >= 0 && resolvedList[activeBatchIndex] ? activeBatchIndex : 0
      setActiveBatchIndex(nextIndex)
      hydratePuzzle(resolvedList[nextIndex], `Batch • ${themeAngle}`)
    } catch (e) {
      if (!append) {
        setBatchPuzzles([])
        setActiveBatchIndex(-1)
      }
      setBatchError(e?.message || 'Failed to load puzzle batch.')
    } finally {
      setBatchLoading(false)
    }
  }

  const loadLivePuzzles = async (append = false, requestedCount = null) => {
    setBatchLoading(true)
    setBatchError('')

    try {
      // Live puzzles: use a shuffled subset of local puzzles
      const count = Math.max(1, Math.min(50, Number(requestedCount || batchSize)))
      const shuffled = [...LOCAL_FALLBACK_PUZZLES].sort(() => Math.random() - 0.5)
      const incoming = Array.from({ length: count }, (_, i) => {
        const src = shuffled[i % shuffled.length]
        return { ...src, puzzle: { ...src.puzzle, id: `${src.puzzle.id}-live-${i}` } }
      })

      if (!incoming.length) {
        setBatchError('No live puzzles returned. Try another filter.')
        if (!append) {
          setBatchPuzzles([])
          setActiveBatchIndex(-1)
        }
        return
      }

      let resolvedList = incoming
      setBatchPuzzles((prev) => {
        resolvedList = append ? mergeUniquePuzzles(prev, incoming) : incoming
        return resolvedList
      })

      const nextIndex = append && activeBatchIndex >= 0 && resolvedList[activeBatchIndex] ? activeBatchIndex : 0
      setActiveBatchIndex(nextIndex)
      hydratePuzzle(resolvedList[nextIndex], `Live • ${themeAngle}`)
    } catch (liveError) {
      if (!append) {
        setBatchPuzzles([])
        setActiveBatchIndex(-1)
      }
      setBatchError(liveError?.message || 'Failed to load live puzzles.')
    } finally {
      setBatchLoading(false)
    }
  }

  const openBatchPuzzleAt = (index) => {
    const target = batchPuzzles[index]
    if (!target) return

    setActiveBatchIndex(index)
    try {
      hydratePuzzle(target, `Batch • ${themeAngle}`)
    } catch (e) {
      setPuzzleError(e?.message || 'Failed to open batch puzzle')
    }
  }

  const openNextBatchPuzzle = () => {
    if (!batchPuzzles.length) return
    const nextIndex = activeBatchIndex + 1
    if (!batchPuzzles[nextIndex]) {
      setStatusMessage('No next puzzle loaded. Use Load More to fetch additional puzzles.')
      return
    }
    openBatchPuzzleAt(nextIndex)
  }

  useEffect(() => {
    loadLivePuzzles(false, 12)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let active = true
    fetchProgressOverview()
      .then((data) => {
        if (!active || !data) return
        setSolvedCount(Number(data?.puzzles?.solved || 0))
        setMistakeCount(Number(data?.puzzles?.mistakes || 0))
      })
      .catch(() => {
        // Ignore when user is not signed in.
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!boardFrameRef.current) return
    let timeoutId = null
    const observer = new ResizeObserver((entries) => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        for (let entry of entries) {
          const { width, height } = entry.contentRect
          const size = Math.max(280, Math.min(width, height) - 24)
          setBoardWidth(size)
        }
      }, 50)
    })
    observer.observe(boardFrameRef.current)
    return () => {
      observer.disconnect()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (wrongMoveResetTimeoutRef.current) {
        clearTimeout(wrongMoveResetTimeoutRef.current)
      }
    }
  }, [])

  const onPieceDrop = (sourceSquare, targetSquare) => {
    unlockAudio()

    if (!isBoardSquare(sourceSquare) || !isBoardSquare(targetSquare) || sourceSquare === targetSquare) {
      playIllegal()
      return false
    }

    const expectedMove = puzzleMeta?.solution?.[solutionPly] || null
    const rebuilt = rebuildPuzzlePosition(puzzleMeta, solutionPly)
    let effectiveGame = rebuilt || new Chess(game.fen())
    let sourcePiece = effectiveGame.get(sourceSquare)

    if (rebuilt && rebuilt.fen() !== game.fen()) {
      setGame(new Chess(rebuilt.fen()))
      const rebuiltHistory = rebuilt.history({ verbose: true })
      const rebuiltLast = rebuiltHistory.length ? rebuiltHistory[rebuiltHistory.length - 1] : null
      setLastMove(rebuiltLast ? { from: rebuiltLast.from, to: rebuiltLast.to } : null)
    }

    if (!sourcePiece) {
      playIllegal()
      return false
    }

    if (sourcePiece.color !== effectiveGame.turn()) {
      setStatusMessage(`It is ${toMoveLabel(effectiveGame.turn())} to move.`)
      playIllegal()
      return false
    }

    let forcedPromotion = 'q'
    if (expectedMove && expectedMove.length === 5 && expectedMove.slice(0, 4) === `${sourceSquare}${targetSquare}`) {
      forcedPromotion = expectedMove[4]
    }

    const probe = new Chess(effectiveGame.fen())
    let move = null
    try {
      move = probe.move({ from: sourceSquare, to: targetSquare, promotion: forcedPromotion })
    } catch {
      move = null
    }

    if (!move) {
      playIllegal()
      return false
    }

    const playedUci = `${move.from}${move.to}${move.promotion || ''}`.toLowerCase()
    const normalizedExpected = String(expectedMove || '').toLowerCase()
    const moveMatches = !normalizedExpected
      ? true
      : normalizedExpected.length === 4
        ? playedUci.startsWith(normalizedExpected)
        : playedUci === normalizedExpected

    if (expectedMove && !moveMatches) {
      setStatusMessage('Not the puzzle move. Try again.')
      setMistakeCount((v) => v + 1)
      recordPuzzleAttempt({ solved: false, mistake: true, theme: themeAngle }).catch(() => {})

      // Show the attempted legal move briefly, then restore canonical puzzle state.
      setGame(new Chess(probe.fen()))
      setLastMove({ from: move.from, to: move.to })
      clearSelection()
      playIllegal()

      if (wrongMoveResetTimeoutRef.current) {
        clearTimeout(wrongMoveResetTimeoutRef.current)
      }

      const canonicalBefore = new Chess(effectiveGame.fen())
      const canonicalHistory = canonicalBefore.history({ verbose: true })
      const canonicalLast = canonicalHistory.length ? canonicalHistory[canonicalHistory.length - 1] : null

      wrongMoveResetTimeoutRef.current = setTimeout(() => {
        setGame(new Chess(canonicalBefore.fen()))
        setLastMove(canonicalLast ? { from: canonicalLast.from, to: canonicalLast.to } : null)
        clearSelection()
      }, 520)

      return true
    }

    if (move.promotion || String(move.san || '').includes('=')) {
      playPromotion()
    } else if (String(move.san || '') === 'O-O' || String(move.san || '') === 'O-O-O') {
      playCastle()
    } else if (move.captured) {
      playCapture()
    } else {
      playMove()
    }

    let nextPly = expectedMove ? solutionPly + 1 : solutionPly
    let nextLastMove = { from: sourceSquare, to: targetSquare }

    if (expectedMove && nextPly < puzzleMeta.solution.length) {
      const replyUci = puzzleMeta.solution[nextPly]
      const replyMove = applyUciMove(probe, replyUci)
      if (replyMove) {
        if (replyMove.promotion || String(replyMove.san || '').includes('=')) {
          playPromotion()
        } else if (String(replyMove.san || '') === 'O-O' || String(replyMove.san || '') === 'O-O-O') {
          playCastle()
        } else if (replyMove.captured) {
          playCapture()
        } else {
          playMove()
        }

        nextLastMove = { from: replyMove.from, to: replyMove.to }
        nextPly += 1
      }
    }

    if (probe.isCheck()) {
      playCheck()
    }
    if (probe.isGameOver() || (expectedMove && nextPly >= puzzleMeta.solution.length)) {
      playGameEnd()
    }

    setGame(new Chess(probe.fen()))
    setLastMove(nextLastMove)
    clearSelection()

    if (expectedMove) {
      setSolutionPly(nextPly)
      if (nextPly >= puzzleMeta.solution.length) {
        setStatusMessage('Puzzle solved. Great job.')
        setSolvedCount((v) => v + 1)
        recordPuzzleAttempt({ solved: true, mistake: false, theme: themeAngle }).catch(() => {})
      } else {
        setStatusMessage('Correct move. Keep going.')
      }
    } else {
      setStatusMessage('Move played.')
    }

    return true
  }

  const onSquareClick = (square) => {
    if (!selectedSquare) {
      selectSquare(square)
      return
    }

    if (selectedSquare === square) {
      clearSelection()
      return
    }

    const moved = onPieceDrop(selectedSquare, square)
    if (!moved) {
      selectSquare(square)
    }
  }

  return (
    <div className='grid grid-cols-1 gap-4 xl:grid-cols-12'>
      <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-4 backdrop-blur xl:col-span-8'>
        <div className='mb-5 overflow-hidden rounded-2xl border border-cyan-300/20 bg-[radial-gradient(120%_120%_at_10%_0%,rgba(34,211,238,0.23)_0%,rgba(15,23,42,0.2)_45%,rgba(2,6,23,0.15)_100%)] p-4'>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div>
              <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/90'>Professional Puzzle Studio</p>
              <h2 className='mt-2 text-3xl font-semibold text-white'>Solve Puzzles</h2>
              <p className='mt-2 max-w-2xl text-sm text-slate-300'>Live puzzle feeds are blended with your training workspace, so you can practice tactical themes, track progress, and solve curated lines in one place.</p>
            </div>
            <div className='rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-2 text-right'>
              <p className='text-[11px] uppercase tracking-wide text-cyan-200'>Puzzle Progress</p>
              <p className='text-2xl font-bold text-white'>{solvedCount}</p>
              <p className='text-[11px] text-cyan-100/80'>Solved: {solvedCount} | Mistakes: {mistakeCount}</p>
            </div>
          </div>
        </div>

        <div className='mb-3 grid grid-cols-2 gap-2 md:grid-cols-4'>
          <div className='rounded-lg border border-white/10 bg-[#2d2d30] px-3 py-2 text-center'>
            <p className='text-[11px] text-slate-400'>Solved</p>
            <p className='text-xl font-bold text-emerald-300'>{solvedCount}</p>
          </div>
          <div className='rounded-lg border border-white/10 bg-[#2d2d30] px-3 py-2 text-center'>
            <p className='text-[11px] text-slate-400'>Mistakes</p>
            <p className='text-xl font-bold text-amber-300'>{mistakeCount}</p>
          </div>
          <div className='rounded-lg border border-white/10 bg-[#2d2d30] px-3 py-2 text-center'>
            <p className='text-[11px] text-slate-400'>Current Theme</p>
            <p className='text-sm font-semibold text-cyan-200'>{themeAngle}</p>
          </div>
          <div className='rounded-lg border border-white/10 bg-[#2d2d30] px-3 py-2 text-center'>
            <p className='text-[11px] text-slate-400'>Difficulty</p>
            <p className='text-sm font-semibold text-white'>{difficulty}</p>
          </div>
        </div>

        <div className='mb-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'>
          <label className='text-xs font-semibold uppercase tracking-wide text-slate-300'>Theme
            <select
              value={themeAngle}
              onChange={(event) => setThemeAngle(event.target.value)}
              className='mt-1 w-full rounded-lg border border-white/15 bg-[#2d2d30] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/70'
            >
              {PUZZLE_THEME_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className='text-xs font-semibold uppercase tracking-wide text-slate-300'>Difficulty
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              className='mt-1 w-full rounded-lg border border-white/15 bg-[#2d2d30] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/70'
            >
              {DIFFICULTY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className='text-xs font-semibold uppercase tracking-wide text-slate-300'>Color
            <select
              value={forcedColor}
              onChange={(event) => setForcedColor(event.target.value)}
              className='mt-1 w-full rounded-lg border border-white/15 bg-[#2d2d30] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/70'
            >
              {COLOR_OPTIONS.map((option) => (
                <option key={option.value || 'auto'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className='text-xs font-semibold uppercase tracking-wide text-slate-300'>Batch Size
            <select
              value={String(batchSize)}
              onChange={(event) => setBatchSize(Number(event.target.value))}
              className='mt-1 w-full rounded-lg border border-white/15 bg-[#2d2d30] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/70'
            >
              {BATCH_SIZE_OPTIONS.map((size) => (
                <option key={size} value={String(size)}>{size} puzzles</option>
              ))}
            </select>
          </label>
        </div>

        <div ref={boardFrameRef} className='mx-auto max-w-[620px] aspect-square rounded-2xl bg-[#2d2d30] p-3 flex items-center justify-center'>
          <Chessboard
            id='training-board'
            position={fen}
            boardOrientation={boardOrientation}
            onPieceDrop={onPieceDrop}
            onSquareClick={onSquareClick}
            dropOffBoardAction='snapback'
            arePiecesDraggable
            areArrowsAllowed
            boardWidth={boardWidth}
            animationDuration={150}
            customArrows={boardHintArrows}
            customSquareStyles={{
              ...(selectedSquare
                ? {
                    [selectedSquare]: {
                      background: 'rgba(34, 211, 238, 0.25)',
                      boxShadow: 'inset 0 0 0 2px rgba(34, 211, 238, 0.6)'
                    }
                  }
                : {}),
              ...Object.fromEntries(
                legalMoves.map((square) => [
                  square,
                  {
                    background: 'radial-gradient(circle, rgba(16,185,129,0.38) 22%, transparent 24%)'
                  }
                ])
              ),
              ...(lastMove
                ? {
                    [lastMove.from]: { background: 'rgba(250, 204, 21, 0.28)' },
                    [lastMove.to]: { background: 'rgba(250, 204, 21, 0.28)' }
                  }
                : {})
            }}
            customDarkSquareStyle={{ backgroundColor: boardTheme.dark }}
            customLightSquareStyle={{ backgroundColor: boardTheme.light }}
          />
        </div>

        <div className='mt-4 flex flex-wrap gap-2'>
          <button
            onClick={loadLichessDaily}
            disabled={puzzleLoading}
            className='rounded-xl border border-white/15 px-4 py-2.5 text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {puzzleLoading ? 'Loading...' : 'Load Daily Puzzle'}
          </button>

          <button
            onClick={loadRandomPuzzle}
            disabled={puzzleLoading}
            className='rounded-xl border border-white/15 px-4 py-2.5 text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {puzzleLoading ? 'Loading...' : 'Load Random Puzzle'}
          </button>

          <button
            onClick={() => loadLivePuzzles(false)}
            disabled={batchLoading}
            className='rounded-xl border border-white/15 px-4 py-2.5 text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {batchLoading ? 'Loading Live...' : 'Load Live Puzzles'}
          </button>

          <button
            onClick={() => loadBatchPuzzles(false)}
            disabled={batchLoading}
            className='rounded-xl border border-white/15 px-4 py-2.5 text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {batchLoading ? 'Loading Batch...' : 'Load Batch'}
          </button>

          <button
            onClick={() => loadLivePuzzles(true)}
            disabled={batchLoading}
            className='rounded-xl border border-white/15 px-4 py-2.5 text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {batchLoading ? 'Loading...' : 'Load More Live'}
          </button>

          <button
            onClick={openNextBatchPuzzle}
            disabled={activeBatchIndex < 0 || activeBatchIndex >= batchPuzzles.length - 1}
            className='rounded-xl border border-white/15 px-4 py-2.5 text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50'
          >
            Next Batch Puzzle
          </button>

          <button
            onClick={() => analyzeFen(fen, 12)}
            disabled={!ready || isAnalyzing}
            className='rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {isAnalyzing ? 'Finding best line...' : 'Get Hint'}
          </button>
        </div>

        {puzzleError && <p className='mt-3 text-sm text-red-300'>{puzzleError}</p>}
        {batchError && <p className='mt-2 text-sm text-red-300'>{batchError}</p>}
      </section>

      <aside className='space-y-4 xl:col-span-4'>
        <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-4 backdrop-blur'>
          <h3 className='mb-3 text-base font-semibold text-white'>Puzzle Details</h3>
          {!puzzleMeta && !puzzleError && (
            <p className='text-sm text-slate-400'>Load a puzzle to see details and start solving.</p>
          )}
          {puzzleMeta && (
            <div className='space-y-2 text-sm text-slate-300'>
              <div className='rounded-lg bg-[#2d2d30] px-3 py-2'>
                Source: <span className='font-semibold text-white'>{puzzleSource || '-'}</span>
              </div>
              <div className='rounded-lg bg-[#2d2d30] px-3 py-2'>
                Puzzle ID: <span className='font-semibold text-white'>{puzzleMeta.id || '-'}</span>
              </div>
              <div className='rounded-lg bg-[#2d2d30] px-3 py-2'>
                Rating: <span className='font-semibold text-white'>{puzzleMeta.rating || '-'}</span> | Plays: <span className='font-semibold text-white'>{puzzleMeta.plays || '-'}</span>
              </div>
              <div className='rounded-lg bg-[#2d2d30] px-3 py-2'>
                Game: <span className='font-semibold text-white'>{puzzleMeta.white}</span> vs <span className='font-semibold text-white'>{puzzleMeta.black}</span>
              </div>
              <div className='rounded-lg bg-[#2d2d30] px-3 py-2'>
                Time control group: <span className='font-semibold text-white'>{puzzleMeta.perf}</span> | To move: <span className='font-semibold text-white'>{puzzleMeta.toMove}</span>
              </div>
              <div className='rounded-lg bg-[#2d2d30] px-3 py-2'>
                Board orientation: <span className='font-semibold text-white capitalize'>{sideToMove}</span>
              </div>
              <div className='rounded-lg bg-[#2d2d30] px-3 py-2'>
                Progress: <span className='font-semibold text-white'>{solutionLength ? `${solutionPly}/${solutionLength}` : '0/0'}</span> ({progress}%)
              </div>
              {statusMessage && (
                <div className={`rounded-lg bg-[#2d2d30] px-3 py-2 font-semibold ${statusClass}`}>
                  {statusMessage}
                </div>
              )}
              {!!puzzleMeta.themes.length && (
                <div className='flex flex-wrap gap-1.5 pt-1'>
                  {puzzleMeta.themes.slice(0, 12).map((theme) => (
                    <span key={theme} className='rounded-md bg-cyan-500/12 px-2 py-1 text-[11px] text-cyan-200'>
                      {theme}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-4 backdrop-blur'>
          <h3 className='mb-3 text-base font-semibold text-white'>Coach Hint</h3>
          <div className='space-y-2 text-sm text-slate-300'>
            <div className='rounded-lg bg-[#2d2d30] px-3 py-2'>
              Engine: <span className='font-semibold text-white'>{ready ? 'Ready' : 'Loading...'}</span>
            </div>
            <div className='rounded-lg bg-[#2d2d30] px-3 py-2'>
              Puzzle next move: <span className='font-semibold text-white'>{nextPuzzleMove || '-'}</span>
            </div>
            <div className='rounded-lg bg-[#2d2d30] px-3 py-2'>
              Suggested move: <span className='font-semibold text-white'>{bestMove || '-'}</span>
            </div>
            <div className='rounded-lg bg-[#2d2d30] px-3 py-2'>
              Eval: <span className='font-semibold text-white'>{stockfishEvalLabel}</span>
            </div>
            {evaluation?.pv && (
              <div className='rounded-lg bg-[#2d2d30] px-3 py-2 text-xs'>
                Line: {evaluation.pv}
              </div>
            )}
          </div>
        </section>

        <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-4 backdrop-blur'>
          <h3 className='mb-3 text-base font-semibold text-white'>Batch Explorer</h3>
          <p className='mb-3 text-xs text-slate-400'>
            Loaded: <span className='text-slate-200'>{batchPuzzles.length}</span> puzzles for theme <span className='text-slate-200'>{themeAngle}</span>.
          </p>
          {!batchPuzzles.length && !batchLoading && (
            <p className='text-sm text-slate-400'>Load a batch to browse and jump between puzzles.</p>
          )}
          <div className='max-h-80 space-y-2 overflow-auto pr-1'>
            {batchPuzzles.map((entry, index) => {
              const id = entry?.puzzle?.id || `puzzle-${index + 1}`
              const rating = entry?.puzzle?.rating || '-'
              const firstTheme = entry?.puzzle?.themes?.[0] || 'mix'
              const isActive = index === activeBatchIndex

              return (
                <button
                  key={id}
                  type='button'
                  onClick={() => openBatchPuzzleAt(index)}
                  className={[
                    'w-full rounded-lg border px-3 py-2 text-left transition',
                    isActive
                      ? 'border-cyan-300/70 bg-cyan-500/15 text-cyan-100'
                      : 'border-white/10 bg-[#2d2d30] text-slate-200 hover:border-white/20'
                  ].join(' ')}
                >
                  <p className='text-xs font-semibold uppercase tracking-wide'>#{index + 1} • {id}</p>
                  <p className='text-xs text-slate-300'>Rating {rating} • {firstTheme}</p>
                </button>
              )
            })}
          </div>
        </section>
      </aside>
    </div>
  )
}

export default TrainingMode
