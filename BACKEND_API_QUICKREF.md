# Backend API Quick Reference

## Files Structure

```
backend/src/
├── services/
│   └── GameService.js          # Game state management
├── controllers/
│   └── GameController.js       # API handlers
├── routes/
│   └── games.js                # API endpoints
└── server.js                   # Express + Socket.IO server
```

## REST API Endpoints

### Game Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/games` | Create new game |
| GET | `/api/games` | List active games |
| GET | `/api/games/:gameId` | Get game state |
| GET | `/api/games/:gameId/board` | Get board only |
| POST | `/api/games/:gameId/join` | Join game |

### Game Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/games/:gameId/move` | Make a move |
| GET | `/api/games/:gameId/moves?square=e4` | Get legal moves |
| GET | `/api/games/:gameId/all-moves` | Get all legal moves |
| POST | `/api/games/:gameId/resign` | Resign game |
| GET | `/api/games/:gameId/export` | Export as PGN |

### Player Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/players/:playerId/game` | Get player's game |

## Quick API Examples

### 1. Create Game
```bash
POST /api/games
Content-Type: application/json

{
  "playerId": "player-1",
  "username": "Alice"
}
```

**Response:** gameId, status, playerColor

### 2. Join Game
```bash
POST /api/games/{gameId}/join
Content-Type: application/json

{
  "playerId": "player-2",
  "username": "Bob"
}
```

### 3. Make Move
```bash
POST /api/games/{gameId}/move
Content-Type: application/json

{
  "playerId": "player-1",
  "from": "e2",
  "to": "e4",
  "promotion": "q"  // optional
}
```

### 4. Get Board
```bash
GET /api/games/{gameId}/board
```

**Response:** fen, pgn, moves, currentTurn, check, checkmate, stalemate, draw

### 5. Get Legal Moves
```bash
GET /api/games/{gameId}/moves?square=e4
```

**Response:** legalMoves array

## Socket.IO Events

### Emit (Client → Server)

```javascript
// Join game room
socket.emit('join-game', {
  gameId: 'game-id',
  playerId: 'player-id'
})

// Send move
socket.emit('move', {
  gameId: 'game-id',
  playerId: 'player-id',
  from: 'e2',
  to: 'e4',
  promotion: 'q'
})

// Get board state
socket.emit('get-board', {
  gameId: 'game-id'
})

// Get legal moves
socket.emit('get-legal-moves', {
  gameId: 'game-id',
  square: 'e4'
})

// Resign
socket.emit('resign', {
  gameId: 'game-id',
  playerId: 'player-id'
})
```

### Listen (Server → Client)

```javascript
// Player joined
socket.on('player-joined', (data) => {
  // data: { gameId, playerId, gameState }
})

// Move was made
socket.on('move-made', (data) => {
  // data: { gameId, move, fen, currentTurn, status, moveHistory }
})

// Game ended
socket.on('game-ended', (data) => {
  // data: { gameId, result, winner, moveHistory }
})

// Board state (response)
socket.on('board-state', (data) => {
  // data: { gameId, board: { fen, moves, ... } }
})

// Legal moves (response)
socket.on('legal-moves', (data) => {
  // data: { gameId, square, legalMoves }
})

// Player disconnected
socket.on('player-disconnected', (data) => {
  // data: { gameId, playerId, socketId }
})

// Move invalid
socket.on('move-invalid', (data) => {
  // data: { error, move }
})

// Error
socket.on('error', (data) => {
  // data: { message }
})
```

## GameService Methods

### Game Management
```javascript
GameService.createGame(playerId, options)
GameService.joinGame(gameId, playerId, username)
GameService.getGameState(gameId)
GameService.getBoardState(gameId)
GameService.getActiveGames()
GameService.endGame(gameId)
```

### Move Operations
```javascript
GameService.makeMove(gameId, playerId, moveData)
GameService.getLegalMoves(gameId, square)
GameService.getAllLegalMoves(gameId)
GameService.resignGame(gameId, playerId)
```

### Game Status
```javascript
GameService.isCheck(gameId)
GameService.isCheckmate(gameId)
GameService.isStalemate(gameId)
GameService.isDraw(gameId)
GameService.getPlayerColor(gameId, playerId)
```

### Export
```javascript
GameService.exportGamePGN(gameId)
GameService.getGameByPlayerId(playerId)
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error description"
}
```

## Game States

```
"waiting"    → Waiting for opponent
"active"     → Game in progress
"completed"  → Game ended
```

## Move Result Types

```
"white-win"  → White won (checkmate or resignation)
"black-win"  → Black won (checkmate or resignation)
"draw"       → Insufficient material, 50-move rule, or repetition
"stalemate"  → Stalemate
```

## Testing Checklist

- [ ] Create game endpoint works
- [ ] Join game endpoint works
- [ ] Make move endpoint validates correctly
- [ ] Legal moves calculated correctly
- [ ] Game status updated (check, checkmate, etc.)
- [ ] Socket.IO join-game works
- [ ] Socket.IO move event broadcasts
- [ ] Socket.IO game-ended event triggers
- [ ] Board state endpoint works
- [ ] Resign endpoint works
- [ ] Players can't move opponent's pieces
- [ ] Turn alternates correctly

## Common Responses

### Success (200)
```json
{
  "success": true,
  "data": { ... }
}
```

### Created (201)
```json
{
  "success": true,
  "data": { ... }
}
```

### Bad Request (400)
```json
{
  "success": false,
  "error": "Invalid input or game state"
}
```

### Not Found (404)
```json
{
  "success": false,
  "error": "Game not found"
}
```

### Server Error (500)
```json
{
  "success": false,
  "error": "Server error message"
}
```

## Performance Notes

- **Instant**: Move validation, legal move lookup (<5ms)
- **Real-time**: Socket.IO broadcasts (<50ms latency)
- **Scalable**: In-memory storage (upgradable to MongoDB)

## Next Steps

1. ✅ Create GameService
2. ✅ Create GameController
3. ✅ Create game routes
4. ✅ Update server.js
5. ⏳ Add database persistence
6. ⏳ Add game history
7. ⏳ Add cloud deployment

## Frontend Integration

### REST API Usage
```javascript
// Create game
const res = await fetch('/api/games', {
  method: 'POST',
  body: JSON.stringify({ playerId, username })
})

// Make move
const res = await fetch(`/api/games/${gameId}/move`, {
  method: 'POST',
  body: JSON.stringify({ playerId, from, to, promotion })
})
```

### Socket.IO Integration
```javascript
import { io } from 'socket.io-client'

const socket = io('http://localhost:5000')

socket.emit('join-game', { gameId, playerId })
socket.emit('move', { gameId, playerId, from, to })

socket.on('move-made', (data) => {
  // Update game board
})

socket.on('game-ended', (data) => {
  // Show game result
})
```

## Database Schema (Future)

```javascript
// Players
{
  _id: ObjectId,
  username: String,
  email: String,
  rating: Number,
  createdAt: Date
}

// Games
{
  _id: ObjectId,
  gameId: String (unique),
  whitePlayerId: ObjectId,
  blackPlayerId: ObjectId,
  startedAt: Date,
  endedAt: Date,
  result: String,
  moves: [MoveSchema],
  fen: String,
  pgn: String,
  createdAt: Date
}

// Moves
{
  moveNumber: Number,
  playerId: ObjectId,
  color: String,
  move: String,
  fen: String,
  timestamp: Date
}
```
