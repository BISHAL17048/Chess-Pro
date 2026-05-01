import { useState, useCallback, useEffect } from 'react'
import { Chess } from 'chess.js'

/**
 * Custom hook for managing chess game state
 * Provides game state, move handling, and validation
 */
export const useChessGame = () => {
  const [game, setGame] = useState(new Chess())
  const [gameMoves, setGameMoves] = useState([])
  const [gameHistory, setGameHistory] = useState([])
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [legalMoves, setLegalMoves] = useState([])
  const [lastMove, setLastMove] = useState(null)
  const [gameStatus, setGameStatus] = useState('active') // active, checkmate, stalemate, draw, check

  // Update game state whenever game changes
  useEffect(() => {
    updateGameStatus()
  }, [game])

  const updateGameStatus = useCallback(() => {
    if (game.isCheckmate()) {
      setGameStatus('checkmate')
    } else if (game.isStalemate()) {
      setGameStatus('stalemate')
    } else if (game.isDraw()) {
      setGameStatus('draw')
    } else if (game.isCheck()) {
      setGameStatus('check')
    } else {
      setGameStatus('active')
    }
  }, [game])

  // Calculate legal moves for a specific square
  const calculateLegalMoves = useCallback((square) => {
    try {
      const moves = game.moves({ square, verbose: true })
      return moves.map(m => m.to)
    } catch {
      return []
    }
  }, [game])

  // Make a move on the board
  const makeMove = useCallback((from, to, promotion = 'q') => {
    try {
      const result = game.move({ from, to, promotion })
      
      if (result) {
        setGameMoves(prev => [...prev, result])
        setGameHistory(prev => [...prev, {
          move: result.san,
          from,
          to,
          timestamp: new Date().toISOString(),
          piece: result.piece,
          captured: result.captured
        }])
        setLastMove({ from, to })
        setSelectedSquare(null)
        setLegalMoves([])
        
        // Create new game instance to trigger re-render
        setGame(new Chess(game.fen()))
        return result
      }
    } catch (error) {
      console.error('Invalid move:', error)
    }
    return null
  }, [game])

  // Select a square and show legal moves
  const selectSquare = useCallback((square) => {
    if (selectedSquare === square) {
      setSelectedSquare(null)
      setLegalMoves([])
      return
    }

    const piece = game.get(square)
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square)
      setLegalMoves(calculateLegalMoves(square))
    }
  }, [game, selectedSquare, calculateLegalMoves])

  // Reset game to initial state
  const resetGame = useCallback(() => {
    const newGame = new Chess()
    setGame(newGame)
    setGameMoves([])
    setGameHistory([])
    setSelectedSquare(null)
    setLegalMoves([])
    setLastMove(null)
    setGameStatus('active')
  }, [])

  // Undo last move
  const undoMove = useCallback(() => {
    if (gameMoves.length > 0) {
      game.undo()
      setGameMoves(prev => prev.slice(0, -1))
      setGameHistory(prev => prev.slice(0, -1))
      setLastMove(null)
      setSelectedSquare(null)
      setLegalMoves([])
      setGame(new Chess(game.fen()))
    }
  }, [game, gameMoves])

  // Get current turn
  const getTurn = useCallback(() => {
    return game.turn() === 'w' ? 'white' : 'black'
  }, [game])

  // Get FEN position
  const getFEN = useCallback(() => {
    return game.fen()
  }, [game])

  // Load position from FEN
  const loadFEN = useCallback((fen) => {
    try {
      const newGame = new Chess(fen)
      setGame(newGame)
      // Note: this doesn't preserve move history when loading a position
    } catch (error) {
      console.error('Invalid FEN:', error)
    }
  }, [])

  // Check if player can move
  const canMove = useCallback((color) => {
    const currentColor = game.turn() === 'w' ? 'white' : 'black'
    return currentColor === color
  }, [game])

  return {
    game,
    gameMoves,
    gameHistory,
    selectedSquare,
    legalMoves,
    lastMove,
    gameStatus,
    makeMove,
    selectSquare,
    resetGame,
    undoMove,
    getTurn,
    getFEN,
    loadFEN,
    canMove,
    calculateLegalMoves
  }
}

/**
 * Custom hook for handling Socket.IO game events
 */
export const useGameSocket = (socket, gameId, onOpponentMove) => {
  useEffect(() => {
    if (!socket) return

    socket.emit('join-game', gameId)

    const handleOpponentMove = (data) => {
      if (onOpponentMove) {
        onOpponentMove(data)
      }
    }

    socket.on('opponent-move', handleOpponentMove)
    socket.on('game-error', (error) => {
      console.error('Game error:', error)
    })

    return () => {
      socket.off('opponent-move', handleOpponentMove)
      socket.off('game-error')
    }
  }, [socket, gameId, onOpponentMove])

  const emitMove = useCallback((moveData) => {
    if (socket) {
      socket.emit('move', moveData)
    }
  }, [socket])

  const emitGameUpdate = useCallback((updateData) => {
    if (socket) {
      socket.emit('game-update', updateData)
    }
  }, [socket])

  return {
    emitMove,
    emitGameUpdate
  }
}
