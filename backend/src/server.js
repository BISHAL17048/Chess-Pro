import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import gameRoutes from './routes/games.js';
import simpleGameRoutes from './routes/gameRoutes.js';
import authRoutes from './routes/authRoutes.js';
import lichessRoutes from './routes/lichess.js';
import aiReviewRoutes from './routes/aiReview.js';
import ratingsRoutes from './routes/ratings.js';
import progressRoutes from './routes/progress.js';
import tournamentsRoutes from './routes/tournaments.js';
import learnRoutes from './modules/learn/learnRoutes.js';
import puzzleRoutes from './modules/puzzle/puzzleRoutes.js';
import watchRoutes from './modules/watch/watchRoutes.js';
import TournamentService from './services/TournamentService.js';
import { registerChessSocketHandlers } from './sockets/chessSocket.js';
import { registerWatchSocketHandlers } from './sockets/watchSocket.js';

dotenv.config();

const app = express();

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const configuredOrigin = process.env.CLIENT_URL;
  if (configuredOrigin && origin === configuredOrigin) {
    return true;
  }

  return /^http:\/\/localhost:\d+$/.test(origin);
};

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST']
  }
});

const PORT = Number(process.env.PORT || 5000);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chess_app';
const REDIS_URL = String(process.env.REDIS_URL || '').trim();

async function setupSocketScaling(targetIo) {
  if (!REDIS_URL) {
    console.log('Socket scaling: running in single-instance mode (REDIS_URL not set).');
    return null;
  }

  try {
    const pubClient = createClient({ url: REDIS_URL });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    targetIo.adapter(createAdapter(pubClient, subClient));
    console.log('Socket scaling: Redis adapter enabled.');

    return { pubClient, subClient };
  } catch (error) {
    console.warn('Socket scaling: Redis adapter setup failed. Falling back to single-instance mode.');
    console.warn(error.message);
    return null;
  }
}

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Routes
app.get('/api/test', (req, res) => {
  res.send('API working');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Game routes
app.use('/api/games', gameRoutes);
app.use('/api/game', simpleGameRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/lichess', lichessRoutes);
app.use('/api/ai', aiReviewRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/tournaments', tournamentsRoutes);
app.use('/api/learn', learnRoutes);
app.use('/api/puzzle', puzzleRoutes);
app.use('/api/watch', watchRoutes);

registerChessSocketHandlers(io);
registerWatchSocketHandlers(io);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

async function startServer() {
  try {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
      });
      console.log('MongoDB connected');
    } catch (dbError) {
      console.warn('MongoDB connection failed. Running without persistent DB.');
      console.warn(dbError.message);
    }

    await setupSocketScaling(io);

    await new Promise((resolve, reject) => {
      const onError = (error) => {
        cleanup()
        reject(error)
      }

      const onListening = () => {
        cleanup()
        resolve()
      }

      const cleanup = () => {
        httpServer.off('error', onError)
        httpServer.off('listening', onListening)
      }

      httpServer.once('error', onError)
      httpServer.once('listening', onListening)
      httpServer.listen(PORT)
    })

    TournamentService.startScheduler()

    console.log(`Chess server running on http://localhost:${PORT}`)
  } catch (error) {
    if (error?.code === 'EADDRINUSE') {
      console.error(`Server startup failed: port ${PORT} is already in use. Stop the old backend process and restart.`)
      process.exit(1)
    }
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
}

startServer();
