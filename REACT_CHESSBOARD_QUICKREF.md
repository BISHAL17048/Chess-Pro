# Chess Component Quick Reference

## 🚀 Quick Start

### Install Dependencies
```bash
cd frontend
npm install react-chessboard chess --legacy-peer-deps
```

### Use the Component
```jsx
import GameBoard from './components/GameBoard'
import { io } from 'socket.io-client'

function App() {
  const socket = io('http://localhost:5000')
  return <GameBoard socket={socket} />
}
```

## 📦 File Structure

```
frontend/src/
├── components/
│   ├── GameBoard.jsx           # Main chessboard component
│   ├── GameBoard.css           # Component styling
│   └── CHESSBOARD_DOCS.md      # Full documentation
├── hooks/
│   └── useChessGame.js         # Game state management hook
├── utils/
│   └── chessUtils.js           # Chess utility functions
└── App.jsx                     # Main app component
```

## 🎮 Component Features

### Visual Features
- ✅ Professional chessboard with piece visualization
- ✅ Drag-and-drop move system
- ✅ Click-to-select move system
- ✅ Legal move highlighting (green circles)
- ✅ Selected piece highlighting (yellow)
- ✅ Last move highlighting
- ✅ Responsive design
- ✅ Board orientation toggle (white/black)

### Game Logic
- ✅ Move validation via chess.js
- ✅ Legal move calculation
- ✅ Game status tracking (check, checkmate, stalemate, draw)
- ✅ Move history with algebraic notation
- ✅ Undo move functionality
- ✅ Game reset
- ✅ FEN position loading/saving

### Multiplayer Features
- ✅ Socket.IO integration
- ✅ Real-time move synchronization
- ✅ Game ID management
- ✅ Player color assignment
- ✅ Opponent move reception

## 🎯 Key Functions

### Component Methods
```javascript
// In GameBoard component
makeMove(from, to)              // Make a move
handleSquareClick(square)       // Click interface
onPieceDrop(source, target)     // Drag-and-drop interface
handleJoinGame()                // Join multiplayer game
handleResetGame()               // Reset to start position
handleUndo()                    // Undo last move
```

### Hook: useChessGame()
```javascript
const {
  game,                         // Chess instance
  gameMoves,                    // All moves made
  gameHistory,                  // Move history (readable)
  selectedSquare,               // Currently selected piece
  legalMoves,                   // Available moves
  lastMove,                     // Last move made
  gameStatus,                   // Current game state
  makeMove,                     // Function to make move
  selectSquare,                 // Function to select piece
  resetGame,                    // Function to reset
  undoMove,                     // Function to undo
  getTurn,                      // Get current player
  getFEN,                       // Get FEN string
  canMove                       // Check if player can move
} = useChessGame()
```

### Utilities: chessUtils.js
```javascript
isValidMove(game, from, to)               // Validate move
getLegalMoves(game, square)               // Get legal moves
getGameStatus(game)                       // Get game state
getMaterialBalance(game)                  // Material value
getPieceUnicode(piece, color)            // Chess symbols
getMoveHints(game)                        // Move suggestions
exportPGN(game, metadata)                 // Export as PGN
loadPGN(pgn)                              // Load from PGN
```

## 🔌 Socket.IO Events

### Emit (Client → Server)
```javascript
socket.emit('join-game', gameId)
socket.emit('move', {
  gameId, from, to, move, fen, timestamp
})
```

### Listen (Server → Client)
```javascript
socket.on('opponent-move', (data) => {
  // { from, to, move, fen, timestamp }
})
socket.on('game-start', (data) => {
  // { playerColor: 'white' | 'black' }
})
```

## 🎨 Styling

### Tailwind Classes
- `.game-board-container` - Main container
- `.board-wrapper` - Chessboard frame
- `.move-history` - Move list
- `.info-panel` - Control panel
- `.info-card` - Status card

### Custom Square Colors
- **Legal moves**: Green radial gradient
- **Selected piece**: Yellow highlight
- **Last move**: Yellow background

## 🔄 Game State Flow

```
1. Initialize Game
   ↓
2. Display Board
   ↓
3. Select Piece → Show Legal Moves
   ↓
4. Make Move → Validate → Update Board
   ↓
5. Emit to Socket.IO
   ↓
6. Opponent Receives Move → Update Board
   ↓
7. Check Game Status (check, checkmate, etc.)
   ↓
8. Switch Turn / End Game
```

## 🎲 Chess.js Quick API

```javascript
import { Chess } from 'chess.js'

const game = new Chess()

// Moves
game.move('e4')                    // Make move by notation
game.move({from: 'e2', to: 'e4'}) // Make move by squares
game.undo()                        // Undo

// State
game.fen()                         // Get FEN
game.pgn()                         // Get PGN
game.isCheck()                     // Is in check?
game.isCheckmate()                 // Is checkmate?
game.isStalemate()                 // Is stalemate?
game.turn()                        // Current turn ('w' or 'b')

// Moves
game.moves()                       // Available moves
game.moves({verbose: true})        // Detailed moves
game.moves({square: 'e4'})         // Moves from square
```

## 🛠️ Common Tasks

### Make a Move
```javascript
const result = makeMove('e2', 'e4', 'q')
if (result) {
  console.log('Move:', result.san)
}
```

### Get Legal Moves
```javascript
const moves = getLegalMoves(game, 'e4')
```

### Check If Checkmate
```javascript
if (game.isCheckmate()) {
  console.log('Checkmate!')
}
```

### Reset Game
```javascript
resetGame()
```

### Load Position
```javascript
loadFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
```

### Export Game
```javascript
const pgn = exportPGN(game, {
  event: 'Tournament',
  white: 'Player 1',
  black: 'Player 2'
})
```

## 📱 Responsive Design

- Desktop: Full board + control panel side-by-side
- Tablet: Grid layout with board on top
- Mobile: Single column, optimized touch interface

## 🐛 Debugging

### Enable Console Logging
```javascript
// In GameBoard.jsx
console.log('Game state:', game.fen())
console.log('Legal moves:', game.moves())
console.log('Is check:', game.isCheck())
```

### Inspect Move
```javascript
const moves = game.moves({verbose: true})
console.table(moves)
```

### Socket.IO Status
```javascript
socket.on('connect', () => console.log('Connected'))
socket.on('disconnect', () => console.log('Disconnected'))
socket.on('opponent-move', (data) => console.log('Opponent:', data))
```

## ⚙️ Configuration

### Board Props (react-chessboard)
```javascript
<Chessboard
  position={game.fen()}
  onPieceDrop={onPieceDrop}
  boardOrientation={'white'}         // or 'black'
  animationDuration={200}
  arePiecesDraggable={true}
  customSquareStyles={{}}
/>
```

### Environment Variables
```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

## 📚 Resources

- [chess.js Documentation](https://github.com/jhlywa/chess.js)
- [react-chessboard Documentation](https://www.npmjs.com/package/react-chessboard)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [PGN Format](https://www.chess.com/terms/pgn-chess)
- [FEN Notation](https://www.chess.com/terms/fen-chess)

## 🚀 Performance Tips

1. Memoize chess calculations
2. Batch state updates
3. Use React.memo for sub-components
4. Debounce socket events
5. Lazy load AI evaluation

## ✅ Testing Checklist

- [ ] Moves validate correctly
- [ ] Legal moves highlight properly
- [ ] Drag-and-drop works
- [ ] Click interface works
- [ ] Game status updates
- [ ] Socket.IO syncs moves
- [ ] Undo works
- [ ] Reset works
- [ ] Mobile responsive

## 🎓 Learning Path

1. ✅ Understand GameBoard component
2. ✅ Learn useChessGame hook
3. ✅ Use chess.js API
4. ✅ Implement Socket.IO
5. ⏳ Add AI opponent
6. ⏳ Create analysis mode
7. ⏳ Build tournament system
