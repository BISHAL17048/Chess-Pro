import { useState, useEffect, useCallback, useRef } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { useSoundEffects } from '../hooks/useSoundEffects'

// SVG overlay for apples/stars
const AppleOverlay = ({ square, width }) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none', // let clicks pass through to the board
        zIndex: 5
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: width * 0.6, height: width * 0.6, color: '#facc15' }}>
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

function LearnLessonView({ lesson, onBack }) {
  const [levels, setLevels] = useState([])
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  
  const [game, setGame] = useState(new Chess())
  const [apples, setApples] = useState([])
  const [completed, setCompleted] = useState(false)
  const [boardWidth, setBoardWidth] = useState(400)
  const boardFrameRef = useRef(null)
  
  const [mistakes, setMistakes] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [perfectScore, setPerfectScore] = useState(true)
  const [showHint, setShowHint] = useState(false)
  
  const { playMove, playCapture, playGameEnd, playIllegal } = useSoundEffects()

  useEffect(() => {
    let timer = null
    if (!loading && !completed) {
      timer = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [loading, completed])

  useEffect(() => {
    if (!boardFrameRef.current) return
    let timeoutId = null
    const observer = new ResizeObserver((entries) => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        for (let entry of entries) {
          const { width, height } = entry.contentRect
          // Subtract padding to ensure board fits nicely within its container
          const size = Math.min(width, height) - 32 
          if (size > 0) setBoardWidth(size)
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
    let active = true
    setLoading(true)
    fetch(`/api/learn/stage/${lesson.id}`)
      .then(res => res.json())
      .then(payload => {
        if (!active) return
        if (payload.success && payload.data && payload.data.length > 0) {
          setLevels(payload.data)
          loadLevel(payload.data[0])
        } else {
          // Check if this is a known empty category or failed fetch
          console.warn('No levels found for', lesson.id)
          setCompleted(true)
        }
      })
      .catch(console.error)
      .finally(() => { if (active) setLoading(false) })
      
    return () => { active = false }
  }, [lesson.id])

  // Helper to ensure FEN has kings so chess.js doesn't crash
  const ensureKings = (fen) => {
    if (fen.includes('k') && fen.includes('K')) return fen
    
    const parts = fen.split(' ')
    let board = parts[0]
    
    // If missing kings, we just append them to the end of the first rank or 8th rank
    // For simplicity, we can use a raw position object instead of a FEN string for the visual board,
    // and manual validation for the moves, but we'll use chess.js with dummy kings.
    const g = new Chess()
    g.clear()
    
    // Parse the FEN into the clear board
    let ranks = board.split('/')
    for (let r = 0; r < 8; r++) {
      let file = 0
      for (let i = 0; i < ranks[r].length; i++) {
        let char = ranks[r][i]
        if (isNaN(char)) {
          let sq = String.fromCharCode(97 + file) + (8 - r)
          g.put({ type: char.toLowerCase(), color: char === char.toUpperCase() ? 'w' : 'b' }, sq)
          file++
        } else {
          file += parseInt(char)
        }
      }
    }
    
    if (!board.includes('K')) {
      for (const sq of ['a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1']) {
        if (!g.get(sq)) { g.put({ type: 'k', color: 'w' }, sq); break; }
      }
    }
    if (!board.includes('k')) {
      for (const sq of ['h8', 'g8', 'f8', 'e8', 'd8', 'c8', 'b8', 'a8']) {
        if (!g.get(sq)) { g.put({ type: 'k', color: 'b' }, sq); break; }
      }
    }
    
    const newFen = g.fen().split(' ')
    newFen[1] = parts[1] || 'w'
    newFen[2] = parts[2] || '-'
    newFen[3] = parts[3] || '-'
    return newFen.join(' ')
  }

  // Remove dummy kings for visual rendering
  const stripKingsIfDummy = (fen, originalFen) => {
    if (originalFen.includes('k') && originalFen.includes('K')) return fen
    
    const parts = fen.split(' ')
    const originalParts = originalFen.split(' ')
    
    const g = new Chess(fen)
    
    if (!originalParts[0].includes('K')) {
      // Find and remove white king
      for (let r = 1; r <= 8; r++) {
        for (let f = 0; f < 8; f++) {
          const sq = String.fromCharCode(97 + f) + r
          const p = g.get(sq)
          if (p && p.type === 'k' && p.color === 'w') g.remove(sq)
        }
      }
    }
    if (!originalParts[0].includes('k')) {
      // Find and remove black king
      for (let r = 1; r <= 8; r++) {
        for (let f = 0; f < 8; f++) {
          const sq = String.fromCharCode(97 + f) + r
          const p = g.get(sq)
          if (p && p.type === 'k' && p.color === 'b') g.remove(sq)
        }
      }
    }
    
    const newFen = g.fen().split(' ')
    newFen[1] = parts[1]
    return newFen.join(' ')
  }

  const [visualFen, setVisualFen] = useState('8/8/8/8/8/8/8/8 w - - 0 1')
  const [baseOriginalFen, setBaseOriginalFen] = useState('')

  const loadLevel = useCallback((levelData) => {
    try {
      // make sure FEN is valid by appending move numbers if missing
      let fen = levelData.fen
      if (fen.split(' ').length === 4) fen += ' 0 1'
      
      setBaseOriginalFen(fen)
      setVisualFen(fen)
      
      const safeFen = ensureKings(fen)
      const newGame = new Chess(safeFen)
      setGame(newGame)
      setApples(levelData.apples || [])
    } catch (e) {
      console.error('Invalid FEN', levelData.fen, e)
    }
  }, [])

  const onDrop = (sourceSquare, targetSquare) => {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      })

      if (move === null) {
        setMistakes(prev => prev + 1)
        setPerfectScore(false)
        playIllegal()
        return false
      }

      // Check if we captured an apple
      const appleIdx = apples.indexOf(targetSquare)
      let newApples = [...apples]
      
      if (appleIdx !== -1) {
        newApples.splice(appleIdx, 1)
        setApples(newApples)
        playCapture()
      } else {
        playMove()
      }

      const nextFen = game.fen()
      setGame(new Chess(nextFen))
      setVisualFen(stripKingsIfDummy(nextFen, baseOriginalFen))

      // Level complete check
      if (newApples.length === 0) {
        setTimeout(() => {
          playGameEnd()
          if (currentLevelIdx < levels.length - 1) {
            const nextIdx = currentLevelIdx + 1
            setCurrentLevelIdx(nextIdx)
            loadLevel(levels[nextIdx])
          } else {
            setCompleted(true)
          }
        }, 500)
      } else {
        // Switch turn manually in game and visual fen
        setTimeout(() => {
          const flipTurn = (f) => {
            const p = f.split(' ')
            p[1] = p[1] === 'w' ? 'b' : 'w'
            return p.join(' ')
          }
          const curr = game.fen()
          setGame(new Chess(flipTurn(curr)))
          setVisualFen(prev => flipTurn(prev))
        }, 100)
      }

      return true
    } catch (e) {
      setMistakes(prev => prev + 1)
      setPerfectScore(false)
      playIllegal()
      return false
    }
  }

  const customSquareStyles = {}
  apples.forEach(sq => {
    // We use a custom SVG overlay instead of background image for sharper scaling
  })

  // Provide custom rendering for pieces and squares to overlay apples
  const customPieces = undefined // use default pieces
  
  if (loading) return <div className="text-white p-8">Loading lesson...</div>

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">{lesson.title}</h2>
          <p className="text-sm text-slate-400">{lesson.description}</p>
        </div>
      </div>

      {/* Progress Dots */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {levels.map((_, i) => (
          <div 
            key={i} 
            className={`w-3 h-3 rounded-full transition-colors ${
              i < currentLevelIdx ? 'bg-emerald-500' : 
              i === currentLevelIdx ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 
              'bg-white/20'
            }`} 
          />
        ))}
      </div>

      {completed ? (
        <div className="bg-[#1f1f1f] border border-emerald-500/30 rounded-2xl p-12 text-center shadow-2xl">
          <div className="w-20 h-20 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl">🌟</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Lesson Complete!</h2>
          <p className="text-slate-400 mb-8">You have mastered the basics of {lesson.title}.</p>
          
          <div className="grid grid-cols-3 gap-4 mb-8 max-w-md mx-auto">
            <div className="bg-[#2d2d30] rounded-lg p-4">
              <p className="text-2xl font-bold text-white">{Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}</p>
              <p className="text-xs text-slate-400">Time</p>
            </div>
            <div className="bg-[#2d2d30] rounded-lg p-4">
              <p className="text-2xl font-bold text-white">{mistakes}</p>
              <p className="text-xs text-slate-400">Mistakes</p>
            </div>
            <div className="bg-[#2d2d30] rounded-lg p-4">
              <p className="text-2xl font-bold text-white">{perfectScore ? '✓' : '✗'}</p>
              <p className="text-xs text-slate-400">Perfect</p>
            </div>
          </div>

          {perfectScore && (
            <div className="mb-6 inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-2">
              <span className="text-amber-400">💯</span>
              <span className="text-sm font-semibold text-amber-300">Perfect Score Achievement!</span>
            </div>
          )}

          <button 
            onClick={onBack}
            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg transition"
          >
            Back to Courses
          </button>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-8 items-start h-full min-h-0">
          <div ref={boardFrameRef} className="w-full max-w-[500px] aspect-square flex-shrink-0 bg-[#1a1a1a] p-4 rounded-xl border border-white/10 shadow-xl flex items-center justify-center">
            <Chessboard 
              boardWidth={boardWidth}
              position={visualFen} 
              onPieceDrop={onDrop}
              animationDuration={200}
              customSquareStyles={customSquareStyles}
              customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
              customDarkSquareStyle={{ backgroundColor: '#b58863' }}
              customDropSquareStyle={{ boxShadow: 'inset 0 0 1px 6px rgba(255,255,255,0.75)' }}
              customSquare={({ square, children, squareWidth }) => (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  {children}
                  {apples.includes(square) && <AppleOverlay square={square} width={squareWidth} />}
                </div>
              )}
            />
          </div>
          <div className="flex-1">
            <div className="bg-[#252526] border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Goal</h3>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-400">⏱️ {Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}</span>
                  <span className="text-slate-400">❌ {mistakes}</span>
                </div>
              </div>
              <p className="text-slate-300 text-lg mb-6">{levels[currentLevelIdx]?.goal || 'Complete the objective!'}</p>
              
              <div className="mb-6 p-4 bg-[#1f1f1f] rounded-lg border border-white/10">
                <p className="text-sm text-slate-400 mb-2">Level {currentLevelIdx + 1} of {levels.length}</p>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                    style={{ width: `${((currentLevelIdx + 1) / levels.length) * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">1</div>
                  <p className="text-sm text-slate-400">Click and drag your piece</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">2</div>
                  <p className="text-sm text-slate-400">Move it to the star to collect it</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 font-bold">3</div>
                  <p className="text-sm text-slate-400">Collect all stars to advance</p>
                </div>
              </div>

              <button
                onClick={() => setShowHint(!showHint)}
                className="mt-6 w-full py-2 border border-cyan-300/30 text-cyan-300 rounded-lg hover:bg-cyan-500/10 transition text-sm"
              >
                💡 {showHint ? 'Hide Hint' : 'Show Hint'}
              </button>

              {showHint && (
                <div className="mt-3 p-3 bg-cyan-500/10 border border-cyan-300/20 rounded-lg">
                  <p className="text-sm text-cyan-200">
                    {levels[currentLevelIdx]?.hint || 'Look for the shortest path to collect all stars. Plan your moves ahead!'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LearnLessonView
