# React Chessboard Component Documentation

## Overview

This is a complete, production-ready React chessboard component using `react-chessboard` and `chess.js`. It includes drag-and-drop moves, legal move validation, game state management, and real-time Socket.IO integration.

## Features

✅ **Full Chessboard Display**
- Professional 8x8 chessboard with piece visualization
- Smooth piece animations
- Board orientation (white/black perspective)
- Responsive design for mobile and desktop

✅ **Move System**
- Drag-and-drop piece movement
- Click-to-move selection system
- Legal move highlighting with visual indicators
- Move validation using `chess.js`
- Support for special moves (castling, en passant, promotion)

✅ **Game State Management**
- Real-time game status (active, check, checkmate, stalemate, draw)
- Move history with algebraic notation
- Undo functionality
- Game reset capability
- Current turn tracking

✅ **Real-time Features**
- Socket.IO integration for multiplayer games
- Opponent move synchronization
- Game ID management
- Turn-based play validation

✅ **User Interface**
- Game control panel with status indicators
- Move history display
- Legal moves visualization
- Last move highlighting
- Game state information (check, checkmate, etc.)

## Component Structure

```
GameBoard.jsx          # Main chessboard component
├── Chessboard         # react-chessboard visual component
├── Game Controls      # Join game, reset, undo
├── Status Panel       # Game status and turn info
├── Move History       # List of moves made
└── Game State Display # Check/checkmate indicators

Hooks/
├── useChessGame()     # Game state management hook
└── useGameSocket()    # Socket.IO event handling hook

Utils/
├── chessUtils.js      # Chess logic utility functions
├── isValidMove()      # Move validation
├── getLegalMoves()    # Get available moves
├── getGameStatus()    # Check game state
└── getMaterialBalance() # Evaluate material
```

## Installation

```bash
cd frontend
npm install react-chessboard chess socket.io-client --legacy-peer-deps
```

## Usage

### Basic Component Usage

```jsx
import GameBoard from './components/GameBoard'
import { io } from 'socket.io-client'

function App() {
  const socket = io('http://localhost:5000')
  
  return <GameBoard socket={socket} />
}
```

### Using the Game Hook

```jsx
import { useChessGame } from './hooks/useChessGame'

function MyComponent() {
  const {
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
    canMove
  } = useChessGame()

  const handleMove = (from, to) => {
    const result = makeMove(from, to, 'q')
    if (result) {
      // Move succeeded
      console.log('Moved:', result.san)
    }
  }

  return (
    <div>
      <p>Turn: {getTurn()}</p>
      <p>Status: {gameStatus}</p>
      <button onClick={resetGame}>Reset</button>
    </div>
  )
}
```

### Using Chess Utilities

```jsx
import {
  isValidMove,
  getLegalMoves,
  getGameStatus,
  getMaterialBalance,
  getPieceUnicode,
  getMoveHints
} from './utils/chessUtils'
import { Chess } from 'chess.js'

const game = new Chess()

// Check if move is valid
if (isValidMove(game, 'e2', 'e4')) {
  game.move({ from: 'e2', to: 'e4' })
}

// Get legal moves for a square
const moves = getLegalMoves(game, 'e4') // ['d5', 'e5', ...]

// Get game status
const status = getGameStatus(game)
console.log(status)
// {
//   isCheck: false,
//   isCheckmate: false,
//   isStalemate: false,
//   isDraw: false,
//   isGameOver: false,
//   turn: 'white',
//   moves: 1
// }

// Material balance (positive = white ahead)
const balance = getMaterialBalance(game) // 0 (equal)

// Get piece unicode symbols
console.log(getPieceUnicode('q', 'w')) // ♕
console.log(getPieceUnicode('q', 'b')) // ♛

// Get move hints
const hints = getMoveHints(game) // ['e2', 'd2', ...]
```

### Socket.IO Integration

The GameBoard component automatically handles Socket.IO events:

**Emitted Events:**
```javascript
socket.emit('join-game', gameId)
socket.emit('move', {
  gameId,
  from,    // source square
  to,      // destination square
  move,    // algebraic notation (e.g., 'e4')
  fen,     // board position after move
  timestamp
})
```

**Listening Events:**
```javascript
socket.on('opponent-move', (data) => {
  // data = { from, to, move, fen, timestamp }
})
socket.on('game-start', (data) => {
  // data = { playerColor: 'white' | 'black' }
})
```

## Component Props

| Prop | Type | Description |
|------|------|-------------|
| `socket` | Socket.IO | Socket.IO client instance |

## State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `game` | Chess | Current game instance |
| `gameMoves` | Array | Array of move objects |
| `gameHistory` | Array | Human-readable move history |
| `selectedSquare` | String | Currently selected square |
| `legalMoves` | Array | Available moves for selected piece |
| `playerColor` | String | 'white' or 'black' |
| `gameStatus` | String | 'waiting', 'active', 'check', 'checkmate', 'stalemate', 'draw' |
| `turn` | String | 'white' or 'black' |
| `lastMove` | Object | { from, to } of last move |

## Available Functions

### GameBoard Component Methods

```javascript
// Calculate legal moves for a square
calculateLegalMoves(square) // returns string[]

// Handle square click
handleSquareClick(square) // void

// Handle drag-and-drop moves
onPieceDrop(source, target, piece) // returns boolean

// Join a game
handleJoinGame() // void

// Reset the game
handleResetGame() // void

// Undo last move
handleUndo() // void
```

### useChessGame Hook Methods

```javascript
const {
  makeMove(from, to, promotion),     // Make a move
  selectSquare(square),              // Select a piece
  resetGame(),                         // Reset to initial state
  undoMove(),                          // Undo last move
  getTurn(),                           // Get current turn
  getFEN(),                            // Get FEN string
  loadFEN(fen),                        // Load position
  canMove(color),                      // Check if player can move
  calculateLegalMoves(square)          // Get legal moves
} = useChessGame()
```

## Chess.js Integration

The component uses `chess.js` for move validation and game logic:

```javascript
import { Chess } from 'chess.js'

const game = new Chess()

// Make a move
game.move({ from: 'e2', to: 'e4' }) // returns move object
game.move('e4') // returns move object

// Get valid moves
game.moves()                    // ['a3', 'a4', 'b3', ...]
game.moves({ verbose: true })  // detailed move objects

// Check game state
game.isCheck()                  // boolean
game.isCheckmate()              // boolean
game.isStalemate()              // boolean
game.isDraw()                   // boolean
game.isGameOver()               // boolean

// Get position
game.fen()                      // FEN string
game.pgn()                      // PGN notation

// Load position
game.load(fen)                  // load from FEN
game.loadPgn(pgn)               // load from PGN

// Undo moves
game.undo()                     // undo last move
game.undo(2)                    // undo last 2 moves

// Get board state
game.board()                    // 8x8 board array
game.get(square)                // piece on square
```

## Styling

The component uses Tailwind CSS for responsive styling. Key CSS classes:

- `.game-board-container` - Main container
- `.board-wrapper` - Chessboard wrapper
- `.move-history` - Move list display
- `.info-panel` - Control panel
- `.info-card` - Individual status cards

Custom square styles are applied via `customSquareStyles` prop:
- Legal moves: Green radial gradient
- Selected square: Yellow highlighting
- Last move: Yellow background

## Move Highlighting

- **Legal Moves**: Green target circles on valid destination squares
- **Selected Piece**: Yellow highlight with border
- **Last Move**: Yellow background on source and destination squares
- **Check**: Red warning indicator on status panel

## Game Status Indicators

The component displays:
- Current turn (white/black)
- Game status (active/check/checkmate/stalemate/draw)
- Player color
- Total moves made
- Check status
- Checkmate status
- Stalemate status

## Performance Notes

- Move validation: O(1) - instant
- Legal move calculation: O(n) where n = number of pieces (typically < 16)
- Board state updates: Batched via React state
- Socket.IO events: Throttled to prevent race conditions

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Common Issues & Solutions

### Issue: Moves not validating
**Solution**: Ensure the Chess instance is updated after each move
```javascript
setGame(new Chess(game.fen())) // Force re-render
```

### Issue: Board not responding to moves
**Solution**: Check that Socket.IO is connected
```javascript
socket.on('connect', () => console.log('Connected'))
socket.on('disconnect', () => console.log('Disconnected'))
```

### Issue: Peer dependency warnings
**Solution**: Use the `--legacy-peer-deps` flag during installation
```bash
npm install --legacy-peer-deps
```

## API Integration

Expected backend endpoints:

```javascript
POST /api/games         // Create new game
GET /api/games/:id      // Get game details
POST /api/games/:id/move // Submit a move
GET /api/games/:id/history // Get move history
```

Example Socket.IO backend handler:

```javascript
io.on('connection', (socket) => {
  socket.on('join-game', (gameId) => {
    socket.join(gameId)
    socket.emit('game-start', {
      playerColor: 'white',
      fen: new Chess().fen()
    })
  })

  socket.on('move', (data) => {
    io.to(data.gameId).emit('opponent-move', data)
  })
})
```

## Testing

```javascript
import { render, screen } from '@testing-library/react'
import GameBoard from './GameBoard'
import { Chess } from 'chess.js'

describe('GameBoard', () => {
  it('renders chessboard', () => {
    const socket = { on: jest.fn(), emit: jest.fn() }
    render(<GameBoard socket={socket} />)
    expect(screen.getByText(/Game ID/i)).toBeInTheDocument()
  })

  it('validates moves correctly', () => {
    const game = new Chess()
    // Test move validation...
  })
})
```

## Future Enhancements

- [ ] AI opponent using chess engines
- [ ] Game analysis and annotation
- [ ] Opening book display
- [ ] Endgame tablebases
- [ ] Game replay functionality
- [ ] Timed games (blitz, rapid, classical)
- [ ] Tournament mode
- [ ] Player ratings and statistics
- [ ] Voice commands
- [ ] Accessibility improvements

## License

MIT
