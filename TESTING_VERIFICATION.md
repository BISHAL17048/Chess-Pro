# Testing & Verification Guide

## ✅ Installation Verification

### Step 1: Check Dependencies Are Installed
```bash
cd frontend
npm list react-chessboard chess
```

**Expected Output:**
```
chess-frontend@1.0.0
├── chess@1.0.0 or similar
├── react-chessboard@5.10.0 or similar
└── [other dependencies...]
```

If you see "npm ERR! unknown", run:
```bash
npm install react-chessboard chess --legacy-peer-deps
```

---

## 🚀 Running the Application

### Terminal 1: Backend Server
```bash
cd backend
npm run dev
```

**Expected Output:**
```
Chess server running on http://localhost:5000
```

### Terminal 2: Frontend Dev Server
```bash
cd frontend
npm run dev
```

**Expected Output:**
```
Local:   http://localhost:5173/
```

---

## 🎮 Manual Testing

### 1. Visual Inspection
1. Open http://localhost:5173 in browser
2. Verify you see:
   - ✓ Chess board with 8x8 squares
   - ✓ All 32 pieces in starting positions
   - ✓ Board appears in center screen
   - ✓ Control panel on side with status info
   - ✓ "Game ID" input field
   - ✓ Buttons for actions (Join, Undo, Reset)

### 2. Piece Movement - Drag and Drop
1. Click and drag white pawn from e2 to e4
2. Verify piece moves smoothly
3. Try dragging bishop (should be blocked - no legal moves)
4. Try dragging black piece (should be blocked - not their turn)

### 3. Piece Movement - Click Interface
1. Click on white pawn e2
2. Verify pawn squares e3 and e4 highlight with green circles
3. Click on e4 to move there
4. Verify move was made and turn changed to black

### 4. Legal Moves Display
1. Make a move: e2-e4
2. Make another move: e7-e5
3. Click on white knight at b1
4. Verify all legal knight moves highlight (a3, c3)
5. Click on a3 to move knight

### 5. Move History
1. Make several moves (e2-e4, e7-e5, g1-f3, b8-c6)
2. Look at "Moves" section on left side
3. Verify moves appear as: "1. e4", "1... e5", "2. Nf3", etc.

### 6. Game Status Indicators
1. Make moves that create check position
2. Verify "⚠ Check!" appears in status panel
3. Make a move that produces checkmate
4. Verify game status changes to "checkmate"

### 7. Undo Functionality
1. Make a few moves
2. Click "↶ Undo Move" button
3. Verify last move is undone
4. Verify move count decreases
5. Click multiple times to undo several moves

### 8. Reset Functionality
1. Make several moves
2. Click "⟲ Reset Game" button
3. Verify board returns to starting position
4. Verify move history clears
5. Verify move count is 0

### 9. Game ID Join
1. Enter "test-game-1" in Game ID input
2. Click "Join Game"
3. Check browser console (F12) for Socket.IO events
4. Verify no errors appear

---

## 🧪 Code-Based Tests

### Test Move Validation
Create a test file: `frontend/src/__tests__/chessUtils.test.js`

```javascript
import { isValidMove, getLegalMoves, getGameStatus } from '../utils/chessUtils'
import { Chess } from 'chess.js'

describe('Chess Utilities', () => {
  it('validates correct move', () => {
    const game = new Chess()
    expect(isValidMove(game, 'e2', 'e4')).toBe(true)
  })

  it('rejects invalid move', () => {
    const game = new Chess()
    expect(isValidMove(game, 'e2', 'e5')).toBe(false)
  })

  it('gets legal moves', () => {
    const game = new Chess()
    const moves = getLegalMoves(game, 'e2')
    expect(moves).toContain('e3')
    expect(moves).toContain('e4')
    expect(moves.length).toBe(2)
  })

  it('checks game status', () => {
    const game = new Chess()
    const status = getGameStatus(game)
    expect(status.isCheck).toBe(false)
    expect(status.isGameOver).toBe(false)
    expect(status.turn).toBe('white')
  })
})
```

Run tests:
```bash
npm test
```

---

## 🔍 Console Testing

### Open Browser DevTools (F12)
Check Console tab for:

```javascript
// Test chess.js
const Chess = window.Chess  // Should be available
const game = new Chess()
game.move('e4')
console.log('FEN:', game.fen())
console.log('Valid moves:', game.moves())

// Test Socket.IO
const socket = window.socket  // If exposed
socket.emit('join-game', 'test-123')
socket.on('opponent-move', (data) => console.log('Opponent:', data))

// Test component state
// Should see state updates in Network tab
```

---

## 🌐 Network Testing

### 1. Open DevTools → Network Tab
### 2. Make a move
### 3. Look for Socket.IO event
```
Headers:
  transport: websocket
  id: [socket-id]

Payload:
  {
    gameId: "...",
    from: "e2",
    to: "e4",
    move: "e4",
    fen: "...",
    timestamp: "..."
  }
```

---

## 📱 Responsive Design Testing

### Desktop (1920x1080)
- Board and controls side-by-side
- Full UI visible without scrolling

### Tablet (768x1024)
- Board on top, controls below
- Touch-friendly interface

### Mobile (375x667)
- Single column layout
- Vertically stacked elements
- Touch-optimized squares

**Test with browser dev tools:**
```
Ctrl+Shift+M (Windows)
Cmd+Shift+M (Mac)
```

---

## 🐛 Error Checking

### Check Browser Console (F12 → Console)
Should see:
```
✓ No red error messages
✓ No "undefined" errors
✓ No module not found errors
✓ Socket connected: "Connected to server"
```

Should NOT see:
```
✗ "Cannot find module 'react-chessboard'"
✗ "Chess is not defined"
✗ "socket is undefined"
✗ "Failed to connect to WebSocket"
```

### Check Network Tab (F12 → Network)
```
✓ XHR request to /api/test returns 200
✓ WebSocket connection established
✓ No 404 or 500 errors
```

---

## 🎯 Feature Checklist

### Board Features
- [ ] 8x8 chessboard visible
- [ ] All pieces display correctly
- [ ] Pieces are draggable
- [ ] Board is responsive

### Move System
- [ ] Drag-drop moves work
- [ ] Click selection works
- [ ] Legal moves highlight green
- [ ] Invalid moves rejected
- [ ] Selected piece highlights yellow

### Game Logic
- [ ] Moves validate with chess.js
- [ ] Turn changes correctly
- [ ] Check detected and displayed
- [ ] Checkmate detected
- [ ] Stalemate detected

### Controls
- [ ] Game ID input works
- [ ] Join Game button functional
- [ ] Undo button works
- [ ] Reset button works

### Display
- [ ] Move history displayed
- [ ] Game status shown
- [ ] Turn indicator visible
- [ ] Material count accurate

### Real-time
- [ ] Socket.IO connected
- [ ] Moves emitted to server
- [ ] Board updates smooth
- [ ] No lag with local moves

---

## 🚨 Common Issues & Solutions

### Issue: Blank Board
```
Solution:
1. Check browser console (F12) for errors
2. Verify react-chessboard installed: npm list react-chessboard
3. Restart dev server: npm run dev
4. Clear browser cache: Ctrl+Shift+Del
```

### Issue: Pieces Not Moving
```
Solution:
1. Verify onPieceDrop handler in GameBoard.jsx
2. Check that tryMove function is called
3. Look for errors in console
4. Try click interface instead of drag
```

### Issue: Move History Not Displaying
```
Solution:
1. Check gameHistory state is updating
2. Verify gameHistory.map is rendering
3. Look for errors in console
4. Check CSS for move-history overflow
```

### Issue: Socket.IO Not Connecting
```
Solution:
1. Check backend is running on localhost:5000
2. Verify socket URL in App.jsx
3. Check for CORS errors in console
4. Verify Socket.IO is installed in backend
```

### Issue: Peer Dependency Warning
```
Solution (Already done):
npm install --legacy-peer-deps
Or add to .npmrc:
legacy-peer-deps=true
```

---

## 📊 Performance Testing

### Check Render Performance
```javascript
// Open console and run:
performance.mark('move-start')
// Make a move
performance.mark('move-end')
performance.measure('move', 'move-start', 'move-end')
const measure = performance.getEntriesByName('move')[0]
console.log('Move time:', measure.duration, 'ms')
```

**Expected:** < 16ms (60 FPS)

### Check Memory Usage
```javascript
// Open console and run:
console.memory
```

**Expected:** < 50MB

---

## ✅ Complete Test Suite Example

```javascript
// Create: frontend/src/__tests__/GameBoard.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GameBoard from '../components/GameBoard'
import { Chess } from 'chess.js'

describe('GameBoard Component', () => {
  const mockSocket = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  }

  it('renders chessboard', () => {
    render(<GameBoard socket={mockSocket} />)
    expect(screen.getByText(/Game ID/i)).toBeInTheDocument()
  })

  it('displays game controls', () => {
    render(<GameBoard socket={mockSocket} />)
    expect(screen.getByRole('button', { name: /Join Game/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Undo/i })).toBeInTheDocument()
  })

  it('validates moves correctly', async () => {
    const game = new Chess()
    const result = game.move('e4')
    expect(result).not.toBeNull()
    expect(result.san).toBe('e4')
  })

  it('handles game reset', async () => {
    const game = new Chess()
    game.move('e4')
    game.move('e5')
    expect(game.moves().length).toBeGreaterThan(0)
    // After reset
    const newGame = new Chess()
    expect(newGame.moves().length).toBe(20)
  })
})
```

Run with:
```bash
npm test GameBoard.test.jsx
```

---

## 📈 Deployment Testing

Before deploying to production:

1. **Build Test**
   ```bash
   npm run build
   npm run preview
   ```

2. **Environment Variables**
   - [ ] VITE_API_URL set correctly
   - [ ] Socket.IO URL points to production
   - [ ] No localhost references

3. **Production Checklist**
   - [ ] Minified bundle created
   - [ ] No console errors in production build
   - [ ] Source maps configured (or removed)
   - [ ] All environment variables set

---

## 🎓 Final Verification

Run this command to verify everything:
```bash
# Check installations
npm list react-chessboard chess react

# Check file structure
ls -R src/components
ls -R src/hooks
ls -R src/utils

# Build test
npm run build

# Type checking (if using TypeScript)
npm run type-check  # If configured
```

---

## ✨ Success Indicators

You know everything works when:
✅ Board displays with all pieces  
✅ Moves validated and pieces move smoothly  
✅ Legal moves highlight in green  
✅ Game status updates (check, checkmate, etc.)  
✅ Undo/reset work correctly  
✅ Socket.IO connects without errors  
✅ Opponent moves sync in real-time  
✅ No errors in browser console  
✅ Application responsive on mobile  
✅ Performance smooth (60 FPS)

---

**Ready to play chess!** ♟
