import GameService from '../services/GameService.js';

function resolveWinner(result) {
  if (result === 'white-win' || result === 'black-timeout') return 'white'
  if (result === 'black-win' || result === 'white-timeout') return 'black'
  return null
}

function resolveEndReason(result, explicitReason = '') {
  const reason = String(explicitReason || '').toLowerCase()
  if (reason) return reason

  if (result === 'white-timeout' || result === 'black-timeout') return 'timeout'
  if (result === 'draw') return 'draw'
  if (result === 'stalemate') return 'stalemate'
  if (result === 'white-win' || result === 'black-win') return 'checkmate'
  if (result === 'aborted-no-first-move') return 'aborted'
  return 'completed'
}

export function registerChessSocketHandlers(io) {
  // Runtime socket session tracking for reconnect support
  const playerSessions = new Map(); // playerId -> { socketId, gameId, connected, disconnectedAt }
  const emailSockets = new Map(); // email(lowercase) -> Set<socketId>
  const socketEmails = new Map(); // socketId -> email(lowercase)

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())

  const addSocketForEmail = (email, socketId) => {
    const key = normalizeEmail(email)
    if (!key) return

    const current = emailSockets.get(key) || new Set()
    current.add(socketId)
    emailSockets.set(key, current)
    socketEmails.set(socketId, key)
  }

  const removeSocketFromEmail = (socketId) => {
    const key = socketEmails.get(socketId)
    if (!key) return

    const current = emailSockets.get(key)
    if (current) {
      current.delete(socketId)
      if (current.size === 0) {
        emailSockets.delete(key)
      }
    }

    socketEmails.delete(socketId)
  }

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    let currentPlayerId = null;
    let currentGameId = null;

    const handleJoinGame = (data) => {
      try {
        const { gameId, playerId } = data;

        if (!gameId || !playerId) {
          socket.emit('error', { message: 'gameId and playerId are required' });
          return;
        }

        const gameState = GameService.getGameState(gameId);
        if (!gameState) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        const playerColor = GameService.getPlayerColor(gameId, playerId);
        if (!playerColor) {
          socket.emit('error', { message: 'Player is not part of this game' });
          return;
        }

        const existingSession = playerSessions.get(playerId);
        const isReconnect =
          !!existingSession && !existingSession.connected && existingSession.gameId === gameId;

        currentPlayerId = playerId;
        currentGameId = gameId;

        socket.join(gameId);

        playerSessions.set(playerId, {
          socketId: socket.id,
          gameId,
          connected: true,
          disconnectedAt: null
        });

        socket.emit('board-state', {
          gameId,
          board: GameService.getBoardState(gameId),
          playerColor,
          status: gameState.status,
          players: gameState.players
        });

        if (isReconnect) {
          socket.to(gameId).emit('player-reconnected', {
            gameId,
            playerId,
            socketId: socket.id
          });
        }

        socket.to(gameId).emit('player-joined', {
          gameId,
          playerId,
          playerColor,
          gameState: GameService.getGameState(gameId)
        });
      } catch (error) {
        console.error('Error joining game:', error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    }

    socket.on('join-game', handleJoinGame);
    socket.on('joinGame', handleJoinGame);

    socket.on('register-user', (data = {}) => {
      const identityEmail = normalizeEmail(data.email)
      if (!identityEmail || !isValidEmail(identityEmail)) {
        socket.emit('error', { message: 'Valid email is required for registration' })
        return
      }

      removeSocketFromEmail(socket.id)
      addSocketForEmail(identityEmail, socket.id)
      socket.emit('user-registered', { email: identityEmail })
    })

    socket.on('invite-user', (data = {}) => {
      try {
        const toEmail = normalizeEmail(data.toEmail)
        const fromEmail = normalizeEmail(data.fromEmail)
        const fromUsername = String(data.fromUsername || '').trim() || 'Player'
        const gameId = String(data.gameId || '').trim()

        if (!toEmail || !fromEmail || !gameId || !isValidEmail(toEmail) || !isValidEmail(fromEmail)) {
          socket.emit('invite-status', {
            ok: false,
            reason: 'Valid toEmail, fromEmail and gameId are required'
          })
          return
        }

        const game = GameService.getGameById(gameId)
        if (!game) {
          socket.emit('invite-status', {
            ok: false,
            reason: 'Game not found'
          })
          return
        }

        const recipientSockets = emailSockets.get(toEmail)
        if (!recipientSockets || recipientSockets.size === 0) {
          socket.emit('invite-status', {
            ok: false,
            reason: 'User is offline'
          })
          return
        }

        const invitePayload = {
          inviteId: `${gameId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          gameId,
          fromUsername,
          fromEmail,
          toEmail,
          createdAt: new Date().toISOString(),
          mode: game?.timers?.mode || null,
          whitePlayer: game?.players?.white?.username || null
        }

        recipientSockets.forEach((id) => {
          io.to(id).emit('match-invite', invitePayload)
        })

        socket.emit('invite-status', {
          ok: true,
          deliveredTo: toEmail,
          recipientCount: recipientSockets.size
        })
      } catch (error) {
        console.error('Error sending invite:', error)
        socket.emit('invite-status', {
          ok: false,
          reason: 'Failed to send invite'
        })
      }
    })

    socket.on('move', (data) => {
      try {
        const { gameId, playerId, from, to, promotion } = data;

        if (!gameId || !playerId || !from || !to) {
          socket.emit('move-invalid', {
            error: 'gameId, playerId, from and to are required',
            move: data
          });
          return;
        }

        const result = GameService.makeMove(gameId, playerId, {
          from,
          to,
          promotion
        });

        if (!result.success) {
          socket.emit('move-invalid', {
            error: result.error,
            move: data
          });
          return;
        }

        io.to(gameId).emit('move-made', {
          gameId,
          playerId,
          playerColor: GameService.getPlayerColor(gameId, playerId),
          move: result.move,
          from,
          to,
          fen: result.fen,
          pgn: result.pgn,
          currentTurn: result.currentTurn,
          timers: result.timers,
          status: result.status,
          result: result.result,
          reason: resolveEndReason(result.result, result.reason),
          drawDetection: result.drawDetection || { is_draw: false, type: null, automatic: false },
          moveHistory: result.moveHistory
        });

        if (result.status === 'completed') {
          io.to(gameId).emit('game-ended', {
            gameId,
            result: result.result,
            winner: resolveWinner(result.result),
            reason: resolveEndReason(result.result, result.reason),
            moveHistory: result.moveHistory
          });
        }
      } catch (error) {
        console.error('Error making move:', error);
        socket.emit('error', { message: 'Failed to make move' });
      }
    });

    socket.on('get-board', (data) => {
      try {
        const { gameId } = data;
        const boardState = GameService.getBoardState(gameId);

        if (!boardState) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        socket.emit('board-state', {
          gameId,
          board: boardState,
          gameState: GameService.getGameState(gameId)
        });

        if (boardState.status === 'completed') {
          io.to(gameId).emit('game-ended', {
            gameId,
            result: boardState.result,
            winner: resolveWinner(boardState.result),
            reason: resolveEndReason(boardState.result, boardState.reason)
          });
        }
      } catch (error) {
        console.error('Error getting board:', error);
        socket.emit('error', { message: 'Failed to get board' });
      }
    });

    socket.on('get-legal-moves', (data) => {
      try {
        const { gameId, square } = data;
        const moves = GameService.getLegalMoves(gameId, square);

        socket.emit('legal-moves', {
          gameId,
          square,
          legalMoves: moves
        });
      } catch (error) {
        console.error('Error getting legal moves:', error);
        socket.emit('error', { message: 'Failed to get legal moves' });
      }
    });

    socket.on('resign', (data) => {
      try {
        const { gameId, playerId } = data;
        const result = GameService.resignGame(gameId, playerId);

        if (!result.success) {
          socket.emit('error', { message: result.error });
          return;
        }

        io.to(gameId).emit('game-ended', {
          gameId,
          result: result.result,
          winner: result.winner,
          reason: 'resignation'
        });
      } catch (error) {
        console.error('Error resigning:', error);
        socket.emit('error', { message: 'Failed to resign' });
      }
    });

    socket.on('draw-offer', (data) => {
      try {
        const { gameId, playerId } = data || {}
        const result = GameService.offerDraw(gameId, playerId)

        if (!result.success) {
          socket.emit('error', { message: result.error })
          return
        }

        io.to(gameId).emit('draw-offered', {
          gameId,
          drawOffer: result.drawOffer
        })
      } catch (error) {
        console.error('Error offering draw:', error)
        socket.emit('error', { message: 'Failed to offer draw' })
      }
    })

    socket.on('draw-response', (data) => {
      try {
        const { gameId, playerId, accept } = data || {}
        const result = GameService.respondDrawOffer(gameId, playerId, Boolean(accept))

        if (!result.success) {
          socket.emit('error', { message: result.error })
          return
        }

        io.to(gameId).emit('draw-offered', {
          gameId,
          drawOffer: result.drawOffer
        })

        if (result.action === 'accepted') {
          io.to(gameId).emit('game-ended', {
            gameId,
            result: result.result,
            winner: null,
            reason: 'draw-agreed'
          })
        }
      } catch (error) {
        console.error('Error responding to draw offer:', error)
        socket.emit('error', { message: 'Failed to respond to draw offer' })
      }
    })

    socket.on('rematch-offer', (data) => {
      try {
        const { gameId, playerId } = data || {}
        const result = GameService.offerOrAcceptRematch(gameId, playerId)

        if (!result.success) {
          socket.emit('error', { message: result.error })
          return
        }

        if (result.action === 'offered') {
          io.to(gameId).emit('rematch-offered', {
            gameId,
            rematchOffer: result.rematchOffer
          })
          return
        }

        io.to(gameId).emit('rematch-created', {
          previousGameId: gameId,
          session: result.rematchGame
        })
      } catch (error) {
        console.error('Error handling rematch offer:', error)
        socket.emit('error', { message: 'Failed to process rematch' })
      }
    })

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id, 'Player:', currentPlayerId);
      removeSocketFromEmail(socket.id)

      if (currentPlayerId) {
        const previous = playerSessions.get(currentPlayerId);
        if (previous) {
          playerSessions.set(currentPlayerId, {
            ...previous,
            connected: false,
            disconnectedAt: new Date().toISOString()
          });
        }
      }

      if (currentGameId && currentPlayerId) {
        io.to(currentGameId).emit('player-disconnected', {
          gameId: currentGameId,
          playerId: currentPlayerId,
          socketId: socket.id,
          canReconnect: true
        });
      }
    });

    socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });
  });
}
