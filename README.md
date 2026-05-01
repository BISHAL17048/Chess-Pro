# ♟ Chess Web Application

A full-stack, real-time chess web application built with React, Node.js, Express, Socket.IO, and MongoDB.

## Project Structure

```
chess/
├── backend/                 # Express.js server
│   ├── src/
│   │   ├── server.js       # Main server file with Socket.IO
│   │   ├── routes/         # API routes
│   │   └── models/         # MongoDB models (Mongoose)
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
├── frontend/               # React + Vite application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── App.jsx         # Main app component
│   │   ├── main.jsx        # Entry point
│   │   └── index.css       # Tailwind styles
│   ├── public/             # Static assets
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   └── .gitignore
└── README.md
```

## Tech Stack

- **Frontend**
  - React 18
  - Vite (build tool)
  - Tailwind CSS (styling)
  - Socket.IO Client (real-time communication)

- **Backend**
  - Node.js
  - Express.js (web framework)
  - Socket.IO (real-time events)
  - Mongoose (MongoDB ODM)
  - CORS (cross-origin requests)

- **Database**
  - MongoDB (local or cloud)

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MongoDB (local installation or MongoDB Atlas cloud)

## Installation & Setup

### 1. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file (copy from `.env.example`):

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/chess
```

For MongoDB Atlas (cloud):
```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/chess?retryWrites=true&w=majority
```

Start the backend server:

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The backend will run on `http://localhost:5000`

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

### 3. Verify Everything Works

1. Open `http://localhost:5173` in your browser
2. You should see the Chess Game app
3. Check the status panels:
   - Server Status should show "Connected"
   - API Status should show "API Working"
4. Test the API by entering a Game ID and clicking "Join Game"

## API Endpoints

### REST API

- `GET /api/test` - Test endpoint that returns server status
- `GET /api/health` - Health check endpoint

### Socket.IO Events

**Client → Server:**
- `join-game` - Join a game room
- `move` - Send a chess move

**Server → Client:**
- `opponent-move` - Receive opponent's move

### Event Examples

```javascript
// Join a game
socket.emit('join-game', 'game-123');

// Send a move
socket.emit('move', {
  gameId: 'game-123',
  from: { row: 1, col: 0 },
  to: { row: 3, col: 0 },
  timestamp: new Date().toISOString()
});

// Listen for opponent moves
socket.on('opponent-move', (data) => {
  console.log('Opponent moved:', data);
});
```

## CORS Configuration

CORS is configured in the backend to allow requests from `http://localhost:5173`. Update the `CLIENT_URL` environment variable if your frontend runs on a different URL.

```javascript
// backend/src/server.js
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
```

## Running Both Servers

Open two terminals:

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

## Building for Production

### Backend

```bash
npm run start
```

### Frontend

```bash
npm run build
npm run preview
```

## Development Notes

- Backend uses ES Modules (type: "module" in package.json)
- Frontend uses Vite for fast development and optimized builds
- Real-time communication is handled by Socket.IO
- Tailwind CSS for responsive, utility-first styling

## Next Steps

1. Implement chess game logic
2. Create MongoDB schemas for games, users, and moves
3. Add authentication (JWT tokens)
4. Build game history and player profiles
5. Add game rating system
6. Deploy to production (Vercel, Heroku, AWS)

## License

MIT
