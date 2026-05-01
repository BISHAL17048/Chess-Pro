# Backend Game Logic Documentation

## Overview

This document describes the backend game logic for the chess application. The system manages game rooms, validates moves using chess.js, and provides real-time game state synchronization via Socket.IO.

## Architecture

```
Server (Express + Socket.IO)
├── Services
│   └── GameService.js      # Game state management
├── Controllers
│   └── GameController.js   # API request handling
├── Routes
│   └── games.js            # Game API endpoints
└── server.js               # Main server with Socket.IO
```

## GameService

The `GameService` class manages all game state and operations. It maintains:

- **Game Rooms**: Map of `gameId` → game state
- **Player Mapping**: Map of `playerId` → `gameId`

### Key Methods

#### `createGame(playerId, options)`
Creates a new game room.

**Parameters:**
- `playerId` (string): ID of the player creating the game
- `options` (object): Optional configuration
  - `username` (string): Player's display name

**Returns:** Game info with gameId and initial board state

```javascript
const game = GameService.createGame('player-1', { username: 'Alice' })
// Returns:
{
  gameId: 'uuid-string',
  status: 'waiting',
  playerId: 'player-1',
  playerColor: 'white',
  board: { fen: '...', pgn: '...', moves: [], moveCount: 0 },
  players: { white: {...}, black: {...} }
}
```

#### `joinGame(gameId, playerId, username)`
Joins an existing game as Black.

**Parameters:**
- `gameId` (string): Game room to join
- `playerId` (string): Player ID
- `username` (string): Player's display name

**Returns:** Join result with game state or error

```javascript
const result = GameService.joinGame('game-id', 'player-2', 'Bob')
// Returns:
{
  success: true,
  gameId: 'game-id',
  status: 'active',
  playerId: 'player-2',
  playerColor: 'black',
  board: {...},
  players: {...}
}
```

#### `makeMove(gameId, playerId, moveData)`
Makes a move in an active game.

**Parameters:**
- `gameId` (string): Game room ID
- `playerId` (string): Player making the move
- `moveData` (object):
  - `from` (string): Source square (e.g., 'e2')
  - `to` (string): Destination square (e.g., 'e4')
  - `promotion` (string): Promotion piece if pawn promotion ('q', 'r', 'b', 'n')

**Returns:** Move result with updated board or error

```javascript
const result = GameService.makeMove(gameId, playerId, {
  from: 'e2',
  to: 'e4',
  promotion: 'q'
})
// Returns:
{
  success: true,
  move: 'e4',
  fen: '...',
  pgn: '...',
  currentTurn: 'black',
  status: 'active',
  result: null,
  moveHistory: [...]
}
```

#### `getGameState(gameId)`
Gets complete game state.

```javascript
const state = GameService.getGameState(gameId)
// Returns:
{
  gameId: '...',
  status: 'active',
  fen: '...',
  pgn: '...',
  moves: [...],
  currentTurn: 'white',
  players: {...},
  moveCount: 5,
  result: null,
  createdAt: Date,
  startedAt: Date,
  endedAt: null
}
```

#### `getBoardState(gameId)`
Gets board state only (optimized for frequent queries).

```javascript
const board = GameService.getBoardState(gameId)
// Returns:
{
  fen: '...',
  pgn: '...',
  moves: [...],
  moveCount: 5,
  currentTurn: 'white',
  check: false,
  checkmate: false,
  stalemate: false,
  draw: false
}
```

#### `getLegalMoves(gameId, square)`
Gets legal moves for a piece on a square.

```javascript
const moves = GameService.getLegalMoves(gameId, 'e2')
// Returns: ['e3', 'e4']
```

#### `getAllLegalMoves(gameId)`
Gets all legal moves in current position.

```javascript
const moves = GameService.getAllLegalMoves(gameId)
// Returns: ['a3', 'a4', 'b3', 'b4', ..., 'h6', 'h7']
```

#### Game Status Checks
- `isCheck(gameId)` - Boolean
- `isCheckmate(gameId)` - Boolean
- `isStalemate(gameId)` - Boolean
- `isDraw(gameId)` - Boolean

#### `resignGame(gameId, playerId)`
Player resigns from the game.

```javascript
const result = GameService.resignGame(gameId, playerId)
// Returns:
{
  success: true,
  result: 'black-win',
  winner: 'black'
}
```

#### `getActiveGames()`
Gets list of all active games.

```javascript
const games = GameService.getActiveGames()
// Returns:
[
  {
    gameId: '...',
    status: 'waiting|active',
    whitePlayer: 'Alice',
    blackPlayer: 'Bob|null',
    moveCount: 5,
    createdAt: Date,
    startedAt: Date
  },
  ...
]
```

#### `exportGamePGN(gameId)`
Exports game in PGN (Portable Game Notation) format.

```javascript
const pgn = GameService.exportGamePGN(gameId)
// Returns PGN string with metadata and all moves
```

## GameController

Handles HTTP API requests and delegates to GameService.

### API Endpoints

#### `POST /api/games` - Create Game
Create a new game room.

**Request:**
```json
{
  "playerId": "player-1",
  "username": "Alice"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "gameId": "uuid",
    "status": "waiting",
    "playerColor": "white",
    "board": {...},
    "players": {...}
  }
}
```

#### `GET /api/games` - List Active Games
Get list of all active games waiting for players.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "gameId": "game-1",
      "status": "waiting",
      "whitePlayer": "Alice",
      "blackPlayer": null,
      "moveCount": 0,
      "createdAt": "2026-04-11T..."
    }
  ],
  "count": 1
}
```

#### `GET /api/games/:gameId` - Get Game State
Get complete game state.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "gameId": "game-1",
    "status": "active",
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "pgn": "1. e4",
    "moves": [{"san": "e4", ...}],
    "currentTurn": "black",
    "players": {...},
    "moveCount": 1,
    "result": null
  }
}
```

#### `GET /api/games/:gameId/board` - Get Board State
Get optimized board state (no history).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "fen": "...",
    "pgn": "1. e4",
    "moves": [...],
    "moveCount": 1,
    "currentTurn": "black",
    "check": false,
    "checkmate": false,
    "stalemate": false,
    "draw": false
  }
}
```

#### `POST /api/games/:gameId/join` - Join Game
Join an existing game as Black.

**Request:**
```json
{
  "playerId": "player-2",
  "username": "Bob"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "gameId": "game-1",
    "status": "active",
    "playerColor": "black",
    "board": {...},
    "players": {...}
  }
}
```

#### `POST /api/games/:gameId/move` - Make Move
Make a move in an active game.

**Request:**
```json
{
  "playerId": "player-1",
  "from": "e2",
  "to": "e4",
  "promotion": "q"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "move": "e4",
    "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    "currentTurn": "black",
    "status": "active",
    "result": null,
    "moveHistory": [...]
  }
}
```

#### `GET /api/games/:gameId/moves?square=e4` - Get Legal Moves
Get legal moves for a piece.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "square": "e4",
    "legalMoves": ["d5", "e5", "f5"],
    "moveCount": 3
  }
}
```

#### `GET /api/games/:gameId/all-moves` - Get All Legal Moves
Get all legal moves in current position.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "moves": ["a6", "a5", "b6", "b5", ...],
    "moveCount": 20
  }
}
```

#### `POST /api/games/:gameId/resign` - Resign
Player resigns from game.

**Request:**
```json
{
  "playerId": "player-1"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "result": "black-win",
    "winner": "black"
  }
}
```

#### `GET /api/games/:gameId/export` - Export as PGN
Export game as PGN file.

**Response (200):** Binary PGN file download

#### `GET /api/players/:playerId/game` - Get Player's Game
Get the current game for a player.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "gameId": "game-1",
    "status": "active",
    "fen": "...",
    ...
  }
}
```

## Socket.IO Events

Real-time game synchronization using Socket.IO.

### Client → Server Events

#### `join-game`
Join a game room for real-time updates.

```javascript
socket.emit('join-game', {
  gameId: 'game-1',
  playerId: 'player-1'
})
```

#### `move`
Send a move to the server.

```javascript
socket.emit('move', {
  gameId: 'game-1',
  playerId: 'player-1',
  from: 'e2',
  to: 'e4',
  promotion: 'q'
})
```

#### `get-board`
Request current board state.

```javascript
socket.emit('get-board', {
  gameId: 'game-1'
})
```

#### `get-legal-moves`
Request legal moves for a square.

```javascript
socket.emit('get-legal-moves', {
  gameId: 'game-1',
  square: 'e4'
})
```

#### `resign`
Resign from the game.

```javascript
socket.emit('resign', {
  gameId: 'game-1',
  playerId: 'player-1'
})
```

### Server → Client Events

#### `player-joined`
A player joined the game.

```javascript
socket.on('player-joined', (data) => {
  // data = {
  //   gameId: 'game-1',
  //   playerId: 'player-2',
  //   gameState: {...}
  // }
})
```

#### `move-made`
A move was made in the game.

```javascript
socket.on('move-made', (data) => {
  // data = {
  //   gameId: 'game-1',
  //   playerId: 'player-1',
  //   move: 'e4',
  //   from: 'e2',
  //   to: 'e4',
  //   fen: '...',
  //   currentTurn: 'black',
  //   status: 'active',
  //   result: null,
  //   moveHistory: [...]
  // }
})
```

#### `move-invalid`
Move was invalid.

```javascript
socket.on('move-invalid', (data) => {
  // data = {
  //   error: 'Invalid move',
  //   move: {...}
  // }
})
```

#### `game-ended`
Game ended (checkmate, resignation, draw, etc.).

```javascript
socket.on('game-ended', (data) => {
  // data = {
  //   gameId: 'game-1',
  //   result: 'white-win|black-win|draw|stalemate',
  //   winner: 'white|black|null',
  //   reason: 'checkmate|resignation|draw|stalemate',
  //   moveHistory: [...]
  // }
})
```

#### `board-state`
Response to `get-board` request.

```javascript
socket.on('board-state', (data) => {
  // data = {
  //   gameId: 'game-1',
  //   board: {...}
  // }
})
```

#### `legal-moves`
Response to `get-legal-moves` request.

```javascript
socket.on('legal-moves', (data) => {
  // data = {
  //   gameId: 'game-1',
  //   square: 'e4',
  //   legalMoves: ['d5', 'e5', 'f5']
  // }
})
```

#### `player-disconnected`
A player disconnected from the game.

```javascript
socket.on('player-disconnected', (data) => {
  // data = {
  //   gameId: 'game-1',
  //   playerId: 'player-1',
  //   socketId: 'socket-id'
  // }
})
```

#### `error`
An error occurred.

```javascript
socket.on('error', (data) => {
  // data = { message: 'Error description' }
})
```

## Game State Flow

```
1. Create Game
   └─ createGame() → "waiting" state

2. Player Joins
   └─ joinGame() → "active" state

3. Players Play
   └─ makeMove() → validate, update FEN, check status

4. Check End Conditions
   ├─ isCheckmate() → "completed", result: "white-win" or "black-win"
   ├─ isStalemate() → "completed", result: "stalemate"
   ├─ isDraw() → "completed", result: "draw"
   └─ resignGame() → "completed", result: winner

5. Game Ends
   └─ endGame() → cleanup
```

## Data Structures

### Game State
```javascript
{
  gameId: 'uuid',
  status: 'waiting|active|completed',
  createdAt: Date,
  updatedAt: Date,
  players: {
    white: {
      id: 'player-1',
      socketId: 'socket-1',
      username: 'Alice'
    },
    black: {
      id: 'player-2',
      socketId: 'socket-2',
      username: 'Bob'
    }
  },
  currentTurn: 'white|black',
  board: {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn: '1. e4 e5',
    moves: [moveObject, ...],
    moveCount: 2
  },
  moveHistory: [
    {
      move: 'e4',
      from: 'e2',
      to: 'e4',
      playerId: 'player-1',
      playerColor: 'white',
      timestamp: Date,
      fen: '...'
    },
    ...
  ],
  result: null|'white-win'|'black-win'|'draw'|'stalemate',
  startedAt: Date|null,
  endedAt: Date|null
}
```

### Move Object
```javascript
{
  move: 'e4',           // Algebraic notation
  from: 'e2',           // Source square
  to: 'e4',             // Destination square
  playerId: 'player-1', // Who made the move
  playerColor: 'white', // Which color
  timestamp: Date,      // When the move was made
  fen: '...'            // Board state after move
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description"
}
```

Error codes and messages:
- `400` - Invalid input (missing fields, invalid moves)
- `404` - Resource not found (game not found)
- `500` - Server error

## Performance Considerations

- **Move Validation**: O(1) - instant
- **Legal Move Calculation**: O(n) where n = number of pieces
- **Game State Updates**: Batched via in-memory storage
- **Socket.IO Broadcasting**: Efficient room-based messaging

## Scalability Notes

Current implementation stores games in memory. For production:

1. **Database**: Use MongoDB to persist games
2. **Caching**: Add Redis for active game state
3. **Message Queue**: Use Bull/RabbitMQ for move processing
4. **Load Balancing**: Use sticky sessions for Socket.IO

## Testing

### Manual Testing

```bash
# Create a game
curl -X POST http://localhost:5000/api/games \
  -H "Content-Type: application/json" \
  -d '{"playerId":"player-1","username":"Alice"}'

# Join the game
curl -X POST http://localhost:5000/api/games/[gameId]/join \
  -H "Content-Type: application/json" \
  -d '{"playerId":"player-2","username":"Bob"}'

# Make a move
curl -X POST http://localhost:5000/api/games/[gameId]/move \
  -H "Content-Type: application/json" \
  -d '{"playerId":"player-1","from":"e2","to":"e4","promotion":"q"}'

# Get board state
curl http://localhost:5000/api/games/[gameId]/board

# Get legal moves
curl "http://localhost:5000/api/games/[gameId]/moves?square=e4"
```

## Future Enhancements

- [ ] Database persistence
- [ ] Game history and statistics
- [ ] AI opponent
- [ ] Game analysis and engine evaluation
- [ ] Leaderboard and ratings
- [ ] Chat and messaging
- [ ] Game replays with animation
- [ ] Timed games (blitz, rapid, classical)
- [ ] Tournament mode
- [ ] Mobile app support
