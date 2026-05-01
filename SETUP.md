# Chess Web Application - Setup Commands

## Quick Start Guide

### 1. Install Dependencies

#### Backend
```powershell
cd backend
npm install
```

#### Frontend
```powershell
cd frontend
npm install
```

### 2. Environment Configuration

Create `backend\.env`:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/chess
```

### 3. Start Development Servers

#### Terminal 1 - Backend
```powershell
cd backend
npm run dev
```

Output: Server running on http://localhost:5000

#### Terminal 2 - Frontend
```powershell
cd frontend
npm run dev
```

Output: Local: http://localhost:5173

### 4. Verify Installation

Open browser: http://localhost:5173

Check that:
- ✓ "Connected" appears in Server Status
- ✓ "API Working" appears in API Status
- ✓ "Ready to play" appears in Game Status

### 5. Test Features

1. Enter a Game ID (e.g., "game-1")
2. Click "Join Game"
3. Click two squares on the board to make a move
4. Watch the console for socket events

## Available Commands

### Backend

```powershell
npm run start    # Production mode
npm run dev      # Development with auto-reload (requires nodemon)
```

### Frontend

```powershell
npm run dev      # Development server (hot reload)
npm run build    # Production build
npm run preview  # Preview production build
```

## Troubleshooting

### Port Already in Use
- Backend (5000): `netstat -ano | findstr :5000`
- Frontend (5173): `netstat -ano | findstr :5173`

### MongoDB Connection Issues
- Ensure MongoDB is running locally or update MONGODB_URI for cloud
- Test connection: Visit http://localhost:5000/api/health

### CORS Errors
- Check CLIENT_URL in backend .env matches frontend URL
- Verify Socket.IO origin setting

### Module Not Found
- Run `npm install` in both frontend and backend directories
- Clear cache: `npm cache clean --force`

## Project Structure Recap

```
CHESS/
├── backend/
│   ├── src/
│   │   ├── server.js (main entry point with CORS & Socket.IO)
│   │   ├── routes/ (API endpoints)
│   │   └── models/ (MongoDB schemas)
│   ├── package.json (Express, Socket.IO, Mongoose, CORS)
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/GameBoard.jsx (chess board component)
│   │   ├── App.jsx (main app with Socket.IO connection)
│   │   ├── main.jsx (React entry point)
│   │   └── index.css (Tailwind CSS)
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json (React, Vite, Tailwind, Socket.IO client)
│
└── README.md (detailed documentation)
```

## API Test

Open Postman or use curl:

```powershell
curl http://localhost:5000/api/test
curl http://localhost:5000/api/health
```

Expected responses:
```json
{
  "message": "Chess API is working!",
  "timestamp": "2026-04-11T..."
}

{
  "status": "Server is running"
}
```

## Next Development Steps

1. ✓ Basic server setup with CORS
2. ✓ Socket.IO real-time communication
3. ✓ React frontend with Tailwind CSS
4. ⏳ Chess game logic (piece movement, validation)
5. ⏳ MongoDB models (User, Game, Move schemas)
6. ⏳ Authentication (JWT tokens)
7. ⏳ Game history and leaderboard
8. ⏳ Deploy to production

Happy coding! ♟
