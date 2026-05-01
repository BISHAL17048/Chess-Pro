import { Chess } from 'chess.js'

/**
 * Utility functions for chess game logic
 */

/**
 * Validate if a move is legal
 * @param {Chess} game - Chess game instance
 * @param {string} from - Source square (e.g., 'e2')
 * @param {string} to - Destination square (e.g., 'e4')
 * @returns {boolean}
 */
export const isValidMove = (game, from, to) => {
  try {
    const moves = game.moves({ square: from, verbose: true })
    return moves.some(move => move.to === to)
  } catch {
    return false
  }
}

/**
 * Get all legal moves for a piece on a square
 * @param {Chess} game - Chess game instance
 * @param {string} square - Square position (e.g., 'e4')
 * @returns {string[]} Array of destination squares
 */
export const getLegalMoves = (game, square) => {
  try {
    const moves = game.moves({ square, verbose: true })
    return moves.map(m => m.to)
  } catch {
    return []
  }
}

/**
 * Get game status information
 * @param {Chess} game - Chess game instance
 * @returns {Object} Game status details
 */
export const getGameStatus = (game) => {
  return {
    isCheck: game.isCheck(),
    isCheckmate: game.isCheckmate(),
    isStalemate: game.isStalemate(),
    isDraw: game.isDraw(),
    isGameOver: game.isGameOver(),
    turn: game.turn() === 'w' ? 'white' : 'black',
    moves: game.moves().length
  }
}

/**
 * Convert square notation to algebraic notation
 * @param {string} square - Square (e.g., 'e2')
 * @returns {Object} Position object with file and rank
 */
export const squareToCoords = (square) => {
  return {
    file: square.charCodeAt(0) - 97, // a=0, b=1, ..., h=7
    rank: parseInt(square[1]) - 1 // 1=0, 2=1, ..., 8=7
  }
}

/**
 * Convert coordinates to square notation
 * @param {number} file - File (0-7)
 * @param {number} rank - Rank (0-7)
 * @returns {string} Square notation (e.g., 'e2')
 */
export const coordsToSquare = (file, rank) => {
  return String.fromCharCode(97 + file) + (rank + 1)
}

/**
 * Get material count (piece values)
 * @param {Chess} game - Chess game instance
 * @returns {Object} Material count for both sides
 */
export const getMaterialCount = (game) => {
  const board = game.board()
  const material = {
    white: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    black: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }
  }

  board.forEach(row => {
    row.forEach(square => {
      if (square) {
        const color = square.color === 'w' ? 'white' : 'black'
        material[color][square.type]++
      }
    })
  })

  return material
}

/**
 * Calculate material balance (in pawn units)
 * @param {Chess} game - Chess game instance
 * @returns {number} Material advantage (positive=white ahead, negative=black ahead)
 */
export const getMaterialBalance = (game) => {
  const material = getMaterialCount(game)
  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9 }

  let whiteValue = 0
  let blackValue = 0

  Object.entries(material.white).forEach(([piece, count]) => {
    whiteValue += count * (pieceValues[piece] || 0)
  })

  Object.entries(material.black).forEach(([piece, count]) => {
    blackValue += count * (pieceValues[piece] || 0)
  })

  return whiteValue - blackValue
}

/**
 * Format move for display (e.g., "e4", "Nf3", "O-O")
 * @param {Object} moveObject - Move object from chess.js
 * @returns {string} Formatted move
 */
export const formatMove = (moveObject) => {
  if (!moveObject) return ''
  return moveObject.san || `${moveObject.from}${moveObject.to}`
}

/**
 * Get piece unicode symbol
 * @param {string} piece - Piece character (p, n, b, r, q, k)
 * @param {string} color - Color (w or b)
 * @returns {string} Unicode symbol
 */
export const getPieceUnicode = (piece, color) => {
  const whitePieces = {
    k: '♔',
    q: '♕',
    r: '♖',
    b: '♗',
    n: '♘',
    p: '♙'
  }
  
  const blackPieces = {
    k: '♚',
    q: '♛',
    r: '♜',
    b: '♝',
    n: '♞',
    p: '♟'
  }

  return color === 'w' ? whitePieces[piece] : blackPieces[piece]
}

/**
 * Parse PGN into game moves
 * @param {string} pgn - PGN notation string
 * @returns {Object} Game instance with moves loaded
 */
export const loadPGN = (pgn) => {
  const game = new Chess()
  try {
    game.loadPgn(pgn)
    return game
  } catch (error) {
    console.error('Invalid PGN:', error)
    return null
  }
}

/**
 * Export game as PGN
 * @param {Chess} game - Chess game instance
 * @param {Object} metadata - Game metadata (event, site, date, etc.)
 * @returns {string} PGN notation
 */
export const exportPGN = (game, metadata = {}) => {
  let pgn = ''
  
  // Add metadata tags
  if (metadata.event) pgn += `[Event "${metadata.event}"]\n`
  if (metadata.site) pgn += `[Site "${metadata.site}"]\n`
  if (metadata.date) pgn += `[Date "${metadata.date}"]\n`
  if (metadata.white) pgn += `[White "${metadata.white}"]\n`
  if (metadata.black) pgn += `[Black "${metadata.black}"]\n`
  if (metadata.result) pgn += `[Result "${metadata.result}"]\n`
  
  pgn += '\n'
  pgn += game.pgn() + '\n'
  
  return pgn
}

/**
 * Get suggested hints (best legal moves based on simple heuristics)
 * @param {Chess} game - Chess game instance
 * @returns {string[]} Array of promising squares
 */
export const getMoveHints = (game) => {
  const moves = game.moves({ verbose: true })
  
  // Sort by capture value and piece activity
  const hints = moves.map(move => {
    let score = 0
    
    // Captures are worth considering
    if (move.captured) score += 10
    
    // Checks are interesting
    const testGame = new Chess(game.fen())
    testGame.move(move)
    if (testGame.isCheck()) score += 5
    
    return { move: move.to, score }
  })
  
  return hints
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(h => h.move)
}
