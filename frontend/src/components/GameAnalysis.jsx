import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { useStockfish } from '../hooks/useStockfish'
import { useSoundEffects } from '../hooks/useSoundEffects'
import { useAuthStore } from '../store/useAuthStore'
import { usePlayStore } from '../store/usePlayStore'
import { useBoardThemeStore } from '../store/useBoardThemeStore'
import { recordLearnSession } from '../utils/progressApi'
import { 
  evalToCentipawnsWhite,
  classificationSquareStyle,
  FEEDBACK_ROWS,
  getMeta,
  classificationClasses
} from '../utils/reviewUtils'

const LEARN_BOTS = [
  { id: 'martin', name: 'Martin', rating: 250, skillLevel: 2, depth: 8, randomness: 0.3 },
  { id: 'jimmy', name: 'Jimmy', rating: 650, skillLevel: 5, depth: 10, randomness: 0.2 },
  { id: 'isabel', name: 'Isabel', rating: 1100, skillLevel: 9, depth: 13, randomness: 0.1 },
  { id: 'nelson', name: 'Nelson', rating: 1450, skillLevel: 12, depth: 15, randomness: 0.05 },
  { id: 'antonio', name: 'Antonio', rating: 1800, skillLevel: 16, depth: 17, randomness: 0.02 },
  { id: 'max', name: 'Maximum', rating: 2350, skillLevel: 20, depth: 22, randomness: 0 }
]

const BOT_AVATAR_PALETTES = [
  { bg1: '#2f80ed', bg2: '#56ccf2', coat: '#1f2937', shirt: '#60a5fa', skin: '#f1c7a3', hair: '#111827', piece: '#f8fafc' },
  { bg1: '#11998e', bg2: '#38ef7d', coat: '#1f2937', shirt: '#10b981', skin: '#f2c6a0', hair: '#111827', piece: '#ecfeff' },
  { bg1: '#7f00ff', bg2: '#e100ff', coat: '#312e81', shirt: '#a78bfa', skin: '#efc19c', hair: '#1f2937', piece: '#f5f3ff' },
  { bg1: '#ff6a00', bg2: '#ee0979', coat: '#3f3f46', shirt: '#fb7185', skin: '#f1bf95', hair: '#1f2937', piece: '#fff7ed' },
  { bg1: '#0f2027', bg2: '#2c5364', coat: '#111827', shirt: '#22d3ee', skin: '#efc39f', hair: '#f8fafc', piece: '#e0f2fe' },
  { bg1: '#1d4350', bg2: '#a43931', coat: '#3f3f46', shirt: '#f97316', skin: '#eebd93', hair: '#111827', piece: '#fff1f2' }
]

const reviewWorkflow = [
  { step: 1, title: 'Open your completed game and run full analysis.' },
  { step: 2, title: 'Review mistakes by phase: opening, middlegame, endgame.' },
  { step: 3, title: 'Replay critical lines and save improvements.' }
]

const reviewInsights = [
  { label: 'Accuracy Focus', value: 'Opening + Middlegame', color: 'emerald' },
  { label: 'Blunder Scan', value: 'Enabled', color: 'amber' },
  { label: 'Engine Depth', value: 'Auto', color: 'cyan' }
]

function hashString(value) {
  const input = String(value || '')
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h >>> 0)
}

function createBotAvatarDataUri({ label, palette, pieceGlyph }) {
  const safeLabel = String(label || '').replace(/[&<>'"]/g, '')
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${safeLabel}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.bg1}"/>
      <stop offset="100%" stop-color="${palette.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="14" fill="url(#g)"/>
  <circle cx="48" cy="34" r="17" fill="${palette.skin}"/>
  <path d="M29 25c2-11 36-11 38 0 0 0-3 8-19 8s-19-8-19-8Z" fill="${palette.hair}"/>
  <circle cx="42" cy="35" r="1.8" fill="#111827"/>
  <circle cx="54" cy="35" r="1.8" fill="#111827"/>
  <path d="M42 42c2.5 2.4 9.5 2.4 12 0" stroke="#7c2d12" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M14 94c2-20 14-30 34-30s32 10 34 30" fill="${palette.coat}"/>
  <path d="M29 94c2-15 10-22 19-22s17 7 19 22" fill="${palette.shirt}"/>
  <circle cx="48" cy="69" r="8" fill="${palette.piece}" opacity="0.95"/>
  <text x="48" y="73" text-anchor="middle" font-size="10" font-family="Segoe UI, Arial" fill="#0f172a">${pieceGlyph}</text>
</svg>`.trim()
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function buildBotAvatarMap() {
  const glyphs = ['K', 'Q', 'R', 'B', 'N', 'P']
  const map = {}
  for (const bot of LEARN_BOTS) {
    const seed = hashString(bot.id)
    const palette = BOT_AVATAR_PALETTES[seed % BOT_AVATAR_PALETTES.length]
    const glyph = glyphs[seed % glyphs.length]
    map[bot.id] = createBotAvatarDataUri({ label: bot.name, palette, pieceGlyph: glyph })
  }
  const selfSeed = hashString('you')
  map.__you = createBotAvatarDataUri({ label: 'You', palette: BOT_AVATAR_PALETTES[selfSeed % BOT_AVATAR_PALETTES.length], pieceGlyph: 'YOU' })
  return map
}

function toMoveUci(move) {
  let uci = move.from + move.to
  if (move.promotion) uci += move.promotion
  return uci
}

function GameAnalysis({ socket, hideLiveOptions = false }) {
  const [selectedBotId, setSelectedBotId] = useState('nelson')
  const [game, setGame] = useState(new Chess())
  const [gameStarted, setGameStarted] = useState(false)
  const [gameResult, setGameResult] = useState(null)
  const [moves, setMoves] = useState([])
  const [botThinking, setBotThinking] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [currentEval, setCurrentEval] = useState(0)
  const [analysisLines, setAnalysisLines] = useState([])
  const [gameSaved, setGameSaved] = useState(false)
  const hydratedReviewKeyRef = useRef('')

  const user = useAuthStore((state) => state.user)
  const reviewIntent = usePlayStore((state) => state.reviewIntent)
  const boardTheme = useBoardThemeStore((state) => state.themeId)
  const boardColors = useMemo(() => {
    const themes = {
      green: { light: '#eeeed2', dark: '#769656' },
      brown: { light: '#f0d9b5', dark: '#b58863' },
      blue: { light: '#dee3e6', dark: '#8ca2ad' },
      sand: { light: '#f3e5c8', dark: '#c89b6d' }
    }
    return themes[boardTheme] || themes.green
  }, [boardTheme])
  const botAvatars = useMemo(() => buildBotAvatarMap(), [])
  const selectedBot = LEARN_BOTS.find(b => b.id === selectedBotId) || LEARN_BOTS[0]

  const { 
    ready: engineReady, 
    skillLevel, 
    setSkillLevel, 
    powerMode, 
    setPowerMode,
    analysisDepth,
    setAnalysisDepth,
    analyzeFenAsync 
  } = useStockfish()

  const { playMove, playCapture, playGameEnd, playIllegal } = useSoundEffects()

  // Initialize Stockfish for selected bot
  useEffect(() => {
    if (gameStarted) {
      setSkillLevel(selectedBot.skillLevel)
      setPowerMode('balanced')
      setAnalysisDepth(selectedBot.depth)
    }
  }, [gameStarted, selectedBot, setSkillLevel, setPowerMode, setAnalysisDepth])

  // Bot move logic
  const makeBotMove = useCallback(async () => {
    if (!engineReady || game.isGameOver() || game.turn() !== 'b') return

    setBotThinking(true)
    try {
      const result = await analyzeFenAsync(game.fen(), selectedBot.depth)
      const bestMove = result?.bestMove

      if (bestMove) {
        const move = game.move({
          from: bestMove.substring(0, 2),
          to: bestMove.substring(2, 4),
          promotion: bestMove.length > 4 ? bestMove.substring(4, 5) : undefined
        })

        if (move) {
          if (move.captured) playCapture()
          else playMove()
          
          setGame(new Chess(game.fen()))
          setMoves(prev => [...prev, move.san])
          
          // Check for game over after bot move
          if (game.isGameOver()) {
            handleGameOver()
          }
        }
      }
    } catch (error) {
      console.error('Bot move error:', error)
    }
    setBotThinking(false)
  }, [engineReady, game, selectedBot, analyzeFenAsync, playMove, playCapture])

  // Handle game over
  const handleGameOver = useCallback(() => {
    let result = ''
    let won = false

    if (game.isCheckmate()) {
      won = game.turn() === 'b' // Black to move = White won
      result = won ? 'You won by checkmate!' : `${selectedBot.name} won by checkmate`
    } else if (game.isStalemate()) {
      result = 'Draw by stalemate'
    } else if (game.isThreefoldRepetition()) {
      result = 'Draw by repetition'
    } else if (game.isInsufficientMaterial()) {
      result = 'Draw by insufficient material'
    } else {
      result = 'Game over'
    }

    setGameResult(result)
    setShowAnalysis(true)
    playGameEnd()

    // Save game to backend
    if (!gameSaved && user) {
      saveGame(won, moves.length)
    }
  }, [game, selectedBot, playGameEnd, user, moves, gameSaved])

  // Save game to backend
  const saveGame = async (won, moveCount) => {
    try {
      await recordLearnSession({
        botId: selectedBot.id,
        won,
        moves: moveCount,
        pgn: game.pgn(),
        result: gameResult
      })
      setGameSaved(true)
    } catch (error) {
      console.error('Failed to save game:', error)
    }
  }

  // Player move handler
  const onDrop = (sourceSquare, targetSquare) => {
    try {
      // Check if it's white's turn
      if (game.turn() !== 'w' || botThinking) {
        playIllegal()
        return false
      }

      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      })

      if (move === null) {
        playIllegal()
        return false
      }

      if (move.captured) playCapture()
      else playMove()

      const newGame = new Chess(game.fen())
      setGame(newGame)
      setMoves(prev => [...prev, move.san])

      // Check for game over
      if (newGame.isGameOver()) {
        handleGameOver()
        return true
      }

      // Trigger bot move after player's move
      setTimeout(() => makeBotMove(), 500)
      return true
    } catch {
      playIllegal()
      return false
    }
  }

  const reviewMoves = useMemo(
    () => (Array.isArray(reviewIntent?.moves) ? reviewIntent.moves : [])
      .map((move) => String(move?.san || move?.move || '').trim())
      .filter(Boolean),
    [reviewIntent]
  )

  // Run analysis
  const runAnalysis = async (fenOverride = null) => {
    if (!engineReady) return
    try {
      const result = await analyzeFenAsync(fenOverride || game.fen(), 18)
      setCurrentEval(result.eval)
      setAnalysisLines([result.bestMove])
    } catch (error) {
      console.error('Analysis error:', error)
    }
  }

  // Analyze entire game
  const [analyzedMoves, setAnalyzedMoves] = useState([])
  const [isAnalyzingGame, setIsAnalyzingGame] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)

  const analyzeGame = async (moveList = moves, initialFen = null) => {
    if (!engineReady || moveList.length === 0) return
    
    setIsAnalyzingGame(true)
    setAnalyzedMoves([])
    setAnalysisProgress(0)
    
    const tempGame = new Chess(initialFen || new Chess().fen())
    const analysis = []
    
    for (let i = 0; i < moveList.length; i++) {
      const moveSan = moveList[i]
      const fenBefore = tempGame.fen()
      
      // Get evaluation before move
      const resultBefore = await analyzeFenAsync(fenBefore, 18)
      const evalBefore = resultBefore?.eval || 0
      
      // Make the move
      const move = tempGame.move(moveSan)
      const fenAfter = tempGame.fen()
      
      // Get evaluation after move
      const resultAfter = await analyzeFenAsync(fenAfter, 18)
      const evalAfter = resultAfter?.eval || 0
      
      // Classify the move
      const classification = classifyMove(move, evalBefore, evalAfter, resultBefore?.bestMove)
      
      analysis.push({
        moveNumber: Math.floor(i / 2) + 1,
        san: moveSan,
        uci: move.from + move.to,
        color: i % 2 === 0 ? 'w' : 'b',
        evalBefore: evalToCentipawnsWhite(evalBefore, fenBefore),
        evalAfter: evalToCentipawnsWhite(evalAfter, fenAfter),
        bestMove: resultBefore?.bestMove,
        classification,
        fen: fenBefore
      })
      
      setAnalyzedMoves([...analysis])
      setAnalysisProgress(Math.round(((i + 1) / moveList.length) * 100))
    }
    
    setIsAnalyzingGame(false)
  }

  useEffect(() => {
    const reviewKey = String(reviewIntent?.gameId || reviewIntent?.pgn || '').trim()
    if (!reviewKey || hydratedReviewKeyRef.current === reviewKey) return

    hydratedReviewKeyRef.current = reviewKey

    const initialFen = String(reviewIntent?.initialFen || '').trim() || new Chess().fen()
    const finalFen = String(reviewIntent?.fen || '').trim() || initialFen
    const nextGame = new Chess(finalFen)

    setGame(nextGame)
    setGameStarted(true)
    setGameResult(reviewIntent?.result || 'Completed game loaded for review')
    setMoves(reviewMoves)
    setShowAnalysis(true)
    setCurrentEval(0)
    setAnalysisLines([])
    setGameSaved(true)

    if (reviewMoves.length > 0) {
      void runAnalysis(finalFen)
      void analyzeGame(reviewMoves, initialFen)
    }
  }, [reviewIntent, reviewMoves, analyzeFenAsync, engineReady])

  // Simple move classification
  const classifyMove = (move, evalBefore, evalAfter, bestMove) => {
    const moveUci = move.from + move.to
    const isBest = moveUci === bestMove
    
    // Convert evaluations to centipawns from white perspective
    const beforeCp = evalBefore?.type === 'cp' ? evalBefore.value : (evalBefore?.value > 0 ? 1000 : -1000)
    const afterCp = evalAfter?.type === 'cp' ? evalAfter.value : (evalAfter?.value > 0 ? 1000 : -1000)
    
    const loss = Math.abs(beforeCp - afterCp)
    
    if (isBest) return 'Best'
    if (loss < 30) return 'Good'
    if (loss < 70) return 'Inaccuracy'
    if (loss < 200) return 'Mistake'
    return 'Blunder'
  }

  // Count classifications
  const classificationCounts = useMemo(() => {
    const counts = {}
    FEEDBACK_ROWS.forEach(({ label }) => counts[label] = 0)
    analyzedMoves.forEach(m => {
      counts[m.classification] = (counts[m.classification] || 0) + 1
    })
    return counts
  }, [analyzedMoves])

  // Compute accuracy
  const computeAccuracy = (rows, color) => {
    const own = rows.filter((r) => r.color === color)
    if (!own.length) return 0
    
    const moveAccuracies = own.map((row) => {
      const beforeWin = cpToWinPercent(row.evalBefore)
      const afterWin = cpToWinPercent(row.evalAfter)
      const drop = Math.max(0, beforeWin - afterWin)
      const raw = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669
      return Math.max(0, Math.min(100, raw))
    })
    
    const avg = moveAccuracies.reduce((sum, val) => sum + val, 0) / moveAccuracies.length
    return Math.round(avg)
  }

  const cpToWinPercent = (cp) => {
    const x = Number(cp || 0)
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * x)) - 1)
  }

  const whiteAccuracy = useMemo(() => computeAccuracy(analyzedMoves, 'w'), [analyzedMoves])
  const blackAccuracy = useMemo(() => computeAccuracy(analyzedMoves, 'b'), [analyzedMoves])

  const startNewGame = () => {
    const newGame = new Chess()
    setGame(newGame)
    setGameStarted(true)
    setGameResult(null)
    setMoves([])
    setShowAnalysis(false)
    setCurrentEval(0)
    setAnalysisLines([])
    setGameSaved(false)
    setSkillLevel(selectedBot.skillLevel)
    setPowerMode('balanced')
    setAnalysisDepth(selectedBot.depth)
  }

  const getColorClass = (color) => {
    switch (color) {
      case 'emerald': return 'border-emerald-500/30 bg-emerald-500/10'
      case 'amber': return 'border-amber-500/30 bg-amber-500/10'
      case 'cyan': return 'border-cyan-500/30 bg-cyan-500/10'
      default: return 'border-slate-500/30 bg-slate-500/10'
    }
  }

  // Determine game result styling
  const getGameResultColor = () => {
    if (!gameResult) return ''
    if (gameResult.includes('won')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    if (gameResult.includes('Draw')) return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30'
  }

  return (
    <section className='space-y-6'>
      {/* Hero Section */}
      <div className='rounded-2xl border border-white/10 bg-[#1a1a1a] overflow-hidden'>
        <div className='bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-900/30 via-[#1a1a1a] to-[#1a1a1a] p-6 md:p-8'>
          <p className='text-xs font-bold uppercase tracking-[0.2em] text-emerald-400'>Game Review</p>
          <h2 className='mt-2 text-2xl md:text-3xl font-bold text-white'>Beautiful Analysis Workspace</h2>
          <p className='mt-2 max-w-2xl text-sm text-slate-400'>
            Analyze your games like chess websites: find mistakes, understand best lines, and improve move-by-move with a clean review dashboard.
          </p>
          
          <div className='mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3'>
            {reviewInsights.map((item) => (
              <div key={item.label} className={`rounded-xl border px-4 py-3 ${getColorClass(item.color)}`}>
                <p className='text-[10px] uppercase tracking-wide text-slate-400'>{item.label}</p>
                <p className='text-sm font-semibold text-white mt-0.5'>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className='grid gap-6 xl:grid-cols-[320px_1fr]'>
        {/* Left Sidebar */}
        <aside className='space-y-4'>
          {/* Review Workflow */}
          <div className='rounded-2xl border border-white/10 bg-[#1a1a1a] p-5'>
            <h3 className='text-xs font-bold uppercase tracking-[0.15em] text-slate-400 mb-4'>Review Workflow</h3>
            <div className='space-y-3'>
              {reviewWorkflow.map((item) => (
                <div key={item.step} className='flex gap-3 p-3 rounded-xl bg-[#252525] border border-white/5'>
                  <div className='flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300'>
                    {item.step}
                  </div>
                  <p className='text-sm text-slate-300 leading-relaxed'>{item.title}</p>
                </div>
              ))}
            </div>
            <div className='mt-4 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5'>
              <p className='text-xs text-emerald-300/80'>
                <span className='font-semibold'>Tip:</span> after analysis, replay the same game and compare your move choices.
              </p>
            </div>
          </div>

          {/* Bot Selection */}
          <div className='rounded-2xl border border-white/10 bg-[#1a1a1a] p-5'>
            <h3 className='text-xs font-bold uppercase tracking-[0.15em] text-slate-400 mb-4'>Select Opponent</h3>
            <div className='space-y-2 max-h-[300px] overflow-y-auto pr-1'>
              {LEARN_BOTS.map((bot) => (
                <button
                  key={bot.id}
                  onClick={() => setSelectedBotId(bot.id)}
                  disabled={gameStarted && !gameResult}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    selectedBotId === bot.id 
                      ? 'border-cyan-500/40 bg-cyan-500/10' 
                      : 'border-white/5 bg-[#252525] hover:border-white/10'
                  } ${gameStarted && !gameResult ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <img 
                    src={botAvatars[bot.id]} 
                    alt={bot.name}
                    className='w-10 h-10 rounded-lg'
                  />
                  <div className='flex-1 text-left'>
                    <p className={`text-sm font-semibold ${selectedBotId === bot.id ? 'text-cyan-300' : 'text-white'}`}>
                      {bot.name}
                    </p>
                    <p className='text-xs text-slate-500'>Rating: {bot.rating}</p>
                  </div>
                  {selectedBotId === bot.id && (
                    <div className='w-2 h-2 rounded-full bg-cyan-400' />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Moves List */}
          {gameStarted && moves.length > 0 && (
            <div className='rounded-2xl border border-white/10 bg-[#1a1a1a] p-5'>
              <h3 className='text-xs font-bold uppercase tracking-[0.15em] text-slate-400 mb-4'>Moves</h3>
              <div className='max-h-[200px] overflow-y-auto space-y-1'>
                {moves.map((move, idx) => (
                  <div key={idx} className='flex items-center gap-2 text-sm'>
                    <span className='text-slate-500 w-8'>{Math.floor(idx / 2) + 1}.</span>
                    <span className={idx % 2 === 0 ? 'text-white' : 'text-slate-400'}>{move}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Right Panel - Game Area */}
        <div className='rounded-2xl border border-white/10 bg-[#1a1a1a] p-5'>
          {/* Match Header */}
          <div className='flex items-center justify-between mb-5'>
            <h3 className='text-lg font-bold text-white'>Me vs {selectedBot.name} <span className='text-slate-500'>({selectedBot.rating})</span></h3>
            <div className='flex items-center gap-2'>
              {gameResult && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getGameResultColor()}`}>
                  {gameResult}
                </span>
              )}
              <button
                onClick={startNewGame}
                className='px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors'
              >
                {gameStarted ? 'New Game' : 'Start Game'}
              </button>
            </div>
          </div>

          {/* Game Result Banner */}
          {gameResult && (
            <div className={`mb-4 p-4 rounded-xl border ${getGameResultColor()}`}>
              <p className='text-sm font-semibold'>{gameResult}</p>
              {gameSaved && <p className='text-xs mt-1 opacity-80'>Game saved to your profile</p>}
            </div>
          )}

          {/* Players Bar */}
          <div className='grid grid-cols-2 gap-4 mb-5'>
            {/* Bot Card */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${game.turn() === 'b' && gameStarted && !gameResult ? 'bg-[#2a2a2a] border-cyan-500/30' : 'bg-[#252525] border-white/5'}`}>
              <img 
                src={botAvatars[selectedBot.id]} 
                alt={selectedBot.name}
                className='w-14 h-14 rounded-xl'
              />
              <div>
                <p className='font-semibold text-white'>{selectedBot.name}</p>
                <p className='text-xs text-slate-500'>BOT {selectedBot.rating}</p>
                {botThinking && <p className='text-xs text-cyan-400 animate-pulse'>Thinking...</p>}
              </div>
            </div>

            {/* You Card */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${game.turn() === 'w' && gameStarted && !gameResult ? 'bg-[#2a2a2a] border-cyan-500/30' : 'bg-[#252525] border-white/5'}`}>
              <img 
                src={botAvatars.__you} 
                alt='You'
                className='w-14 h-14 rounded-xl'
              />
              <div>
                <p className='font-semibold text-white'>You</p>
                <p className='text-xs text-slate-500'>White Side</p>
                {game.turn() === 'w' && gameStarted && !gameResult && <p className='text-xs text-cyan-400'>Your move</p>}
              </div>
            </div>
          </div>

          {/* Game Board Area */}
          <div className='aspect-square max-w-[500px] mx-auto bg-[#252525] rounded-xl p-3'>
            {!gameStarted ? (
              <div className='h-full flex flex-col items-center justify-center text-center p-8'>
                <div className='w-16 h-16 rounded-2xl bg-cyan-500/20 flex items-center justify-center mb-4'>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className='text-cyan-400'>
                    <path d="M8 16l-1.447.724a1 1 0 0 0-.553.894V20h12v-2.382a1 1 0 0 0-.553-.894L16 16H8z"/>
                    <path d="M12 4a4 4 0 0 0-4 4 4 4 0 0 0 4 4 4 4 0 0 0 4-4 4 4 0 0 0-4-4"/>
                    <path d="M12 8v8"/>
                  </svg>
                </div>
                <p className='text-lg font-semibold text-white mb-2'>Ready to Play</p>
                <p className='text-sm text-slate-400 mb-4'>Select a bot and click "Start Game" to begin</p>
                <button
                  onClick={startNewGame}
                  className='px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors'
                >
                  Start Game
                </button>
              </div>
            ) : (
              <div className='h-full w-full flex items-center justify-center'>
                <Chessboard 
                  position={game.fen()}
                  onPieceDrop={onDrop}
                  boardWidth={480}
                  customBoardStyle={{
                    borderRadius: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                  }}
                  customDarkSquareStyle={{ backgroundColor: boardColors.dark }}
                  customLightSquareStyle={{ backgroundColor: boardColors.light }}
                />
              </div>
            )}
          </div>

          {/* Engine Status */}
          <div className='mt-5 flex items-center justify-between text-xs'>
            <div className='flex items-center gap-4'>
              <span className='text-slate-500'>Stockfish {engineReady ? '(ready)' : '(loading...)'}</span>
              <span className={`px-2 py-1 rounded-full ${engineReady ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                NNUE {engineReady ? 'ON' : 'OFF'}
              </span>
            </div>
            <div className='flex items-center gap-4 text-slate-500'>
              <span>Depth: {analysisDepth}</span>
              <span>Mode: {powerMode}</span>
            </div>
          </div>

          {/* Post-Game Analysis Panel */}
          {showAnalysis && (
            <div className='mt-4 space-y-4'>
              {/* Quick Analysis */}
              <div className='p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5'>
                <div className='flex items-center justify-between mb-3'>
                  <h4 className='text-sm font-semibold text-cyan-300'>Post-Game Analysis</h4>
                  <div className='flex gap-2'>
                    <button 
                      onClick={runAnalysis}
                      className='px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors'
                    >
                      Analyze Position
                    </button>
                    <button 
                      onClick={analyzeGame}
                      disabled={isAnalyzingGame || moves.length === 0}
                      className='px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-medium transition-colors'
                    >
                      {isAnalyzingGame ? `Analyzing ${analysisProgress}%` : 'Analyze Game'}
                    </button>
                  </div>
                </div>
                
                {analysisLines.length > 0 && (
                  <div className='space-y-2'>
                    <p className='text-xs text-slate-400'>Best move: <span className='text-cyan-300 font-mono'>{analysisLines[0]}</span></p>
                    <p className='text-xs text-slate-400'>Evaluation: <span className={currentEval > 0 ? 'text-emerald-400' : currentEval < 0 ? 'text-rose-400' : 'text-slate-300'}>{currentEval > 0 ? '+' : ''}{currentEval.toFixed(2)}</span></p>
                  </div>
                )}
                
                <div className='mt-3 pt-3 border-t border-white/10'>
                  <p className='text-xs text-slate-500'>Total moves: {moves.length}</p>
                  <p className='text-xs text-slate-500'>Opponent: {selectedBot.name} ({selectedBot.rating})</p>
                </div>
              </div>

              {/* Accuracy Display */}
              {analyzedMoves.length > 0 && (
                <div className='grid grid-cols-3 gap-3'>
                  <div className='rounded-xl border border-white/10 bg-[#252525] p-3 text-center'>
                    <p className='text-[11px] text-slate-400 uppercase tracking-wide'>You</p>
                    <p className='text-2xl font-bold text-white'>{whiteAccuracy}%</p>
                    <p className='text-xs text-slate-500'>Accuracy</p>
                  </div>
                  <div className='flex items-center justify-center'>
                    <span className='text-2xl text-slate-600'>*</span>
                  </div>
                  <div className='rounded-xl border border-white/10 bg-[#252525] p-3 text-center'>
                    <p className='text-[11px] text-slate-400 uppercase tracking-wide'>{selectedBot.name}</p>
                    <p className='text-2xl font-bold text-white'>{blackAccuracy}%</p>
                    <p className='text-xs text-slate-500'>Accuracy</p>
                  </div>
                </div>
              )}

              {/* Move Quality Summary */}
              {analyzedMoves.length > 0 && (
                <div className='p-4 rounded-xl border border-white/10 bg-[#252525]'>
                  <h4 className='text-sm font-semibold text-white mb-3'>Move Summary</h4>
                  <div className='space-y-1'>
                    {FEEDBACK_ROWS.map(({ label, emoji }) => {
                      const wCnt = analyzedMoves.filter((r) => r.classification === label && r.color === 'w').length
                      const bCnt = analyzedMoves.filter((r) => r.classification === label && r.color === 'b').length
                      const meta = getMeta(label)
                      if (wCnt === 0 && bCnt === 0) return null
                      return (
                        <div key={label} className='grid grid-cols-[1fr_60px_1fr] items-center gap-2 rounded px-2 py-1 hover:bg-white/5'>
                          <span className={`text-right text-sm font-bold ${wCnt > 0 ? meta.textClass : 'text-slate-700'}`}>{wCnt}</span>
                          <div className='flex items-center justify-center gap-1'>
                            <span className='text-sm'>{emoji}</span>
                            <span className='text-xs text-slate-400'>{label}</span>
                          </div>
                          <span className={`text-left text-sm font-bold ${bCnt > 0 ? meta.textClass : 'text-slate-700'}`}>{bCnt}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Analyzed Moves List */}
              {analyzedMoves.length > 0 && (
                <div className='p-4 rounded-xl border border-white/10 bg-[#252525] max-h-[300px] overflow-y-auto'>
                  <h4 className='text-sm font-semibold text-white mb-3'>Moves</h4>
                  <div className='space-y-1'>
                    {analyzedMoves.map((m, idx) => {
                      const meta = getMeta(m.classification)
                      return (
                        <div key={idx} className={`flex items-center justify-between py-1.5 px-2 rounded ${meta.bgClass}`}>
                          <div className='flex items-center gap-2'>
                            <span className='text-xs text-slate-500 w-8'>{m.moveNumber}.</span>
                            <span className={`text-sm font-medium ${meta.textClass}`}>{m.san}</span>
                            {m.bestMove && m.uci !== m.bestMove && (
                              <span className='text-xs text-slate-500'>(Best: {m.bestMove})</span>
                            )}
                          </div>
                          <span className='text-sm'>{meta.emoji}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default GameAnalysis
