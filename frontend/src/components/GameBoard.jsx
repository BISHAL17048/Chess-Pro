import React, { useEffect, useMemo, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { BOARD_THEMES, useBoardThemeStore } from '../store/useBoardThemeStore'
import { useSoundEffects } from '../hooks/useSoundEffects'
import './GameBoard.css'

function GameBoard({ socket }) {
  const themeId = useBoardThemeStore((state) => state.themeId)
  const boardTheme = useMemo(() => BOARD_THEMES.find((theme) => theme.id === themeId) || BOARD_THEMES[0], [themeId])

  const [game, setGame] = useState(new Chess())
  const [gameIdInput, setGameIdInput] = useState('')
  const [gameId, setGameId] = useState('')
  const [username, setUsername] = useState('')
  const [gameHistory, setGameHistory] = useState([])
  const [playerColor, setPlayerColor] = useState('white')
  const [gameStatus, setGameStatus] = useState('idle')
  const [turn, setTurn] = useState('white')
  const [lastMove, setLastMove] = useState(null)
  const [error, setError] = useState('')
  const [opponentConnected, setOpponentConnected] = useState(false)
  const { unlockAudio, playMove, playOpponentMove, playCapture, playCastle, playCheck, playPromotion, playIllegal, playGameStart, playGameEnd } = useSoundEffects()

  const playerId = useMemo(() => {
    const saved = localStorage.getItem('chessPlayerId')
    if (saved) return saved

    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? `player_${crypto.randomUUID()}`
      : `player_${Math.random().toString(36).slice(2, 10)}`

    localStorage.setItem('chessPlayerId', id)
    return id
  }, [])

  const isMyTurn = turn === playerColor
  const canMove = gameStatus === 'active' && isMyTurn

  useEffect(() => {
    if (!socket) return

    const handleConnect = () => {
      setError('')
      if (gameId) {
        socket.emit('join-game', { gameId, playerId })
      }
    }

    const handleBoardState = (payload) => {
      if (payload.gameId !== gameId) return

      const board = payload.board || payload.gameState
      if (!board) return

      if (board.fen) {
        setGame(new Chess(board.fen))
      }

      if (board.moves) {
        setGameHistory(board.moves)
      }

      setTurn(board.currentTurn || 'white')
      setGameStatus(payload.status || 'active')

      if (payload.playerColor) {
        setPlayerColor(payload.playerColor)
      }
    }

    const handleMoveMade = (payload) => {
      if (payload.gameId !== gameId) return

      const latestMove = Array.isArray(payload.moveHistory)
        ? payload.moveHistory[payload.moveHistory.length - 1]
        : null
      const san = String(latestMove?.san || latestMove?.move || '')
      const isMine = payload.playerColor === playerColor

      if (latestMove?.promotion || san.includes('=')) {
        playPromotion()
      } else if (san === 'O-O' || san === 'O-O-O') {
        playCastle()
      } else if (latestMove?.captured) {
        playCapture()
      } else if (isMine) {
        playMove()
      } else {
        playOpponentMove()
      }

      setGame(new Chess(payload.fen))
      setGameHistory(payload.moveHistory || [])
      setTurn(payload.currentTurn || 'white')
      setGameStatus(payload.status || 'active')
      setLastMove({ from: payload.from, to: payload.to })
      setError('')

      try {
        const g = new Chess(payload.fen)
        if (g.isCheck()) {
          playCheck()
        }
      } catch {
        // Ignore audio-only parse issues.
      }
    }

    const handleMoveInvalid = (payload) => {
      setError(payload.error || 'Invalid move')
      playIllegal()
      if (gameId) {
        socket.emit('get-board', { gameId })
      }
    }

    const handlePlayerJoined = (payload) => {
      if (payload.gameId !== gameId) return
      setOpponentConnected(true)
      setGameStatus(payload.gameState?.status || 'active')
      playGameStart()
    }

    const handlePlayerDisconnected = (payload) => {
      if (payload.gameId !== gameId) return
      setOpponentConnected(false)
    }

    const handlePlayerReconnected = (payload) => {
      if (payload.gameId !== gameId) return
      setOpponentConnected(true)
    }

    const handleGameEnded = (payload) => {
      if (payload.gameId !== gameId) return
      setGameStatus('completed')
      playGameEnd()
    }

    const handleSocketError = (payload) => {
      setError(payload.message || 'Socket error')
    }

    socket.on('connect', handleConnect)
    socket.on('board-state', handleBoardState)
    socket.on('move-made', handleMoveMade)
    socket.on('move-invalid', handleMoveInvalid)
    socket.on('player-joined', handlePlayerJoined)
    socket.on('player-disconnected', handlePlayerDisconnected)
    socket.on('player-reconnected', handlePlayerReconnected)
    socket.on('game-ended', handleGameEnded)
    socket.on('error', handleSocketError)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('board-state', handleBoardState)
      socket.off('move-made', handleMoveMade)
      socket.off('move-invalid', handleMoveInvalid)
      socket.off('player-joined', handlePlayerJoined)
      socket.off('player-disconnected', handlePlayerDisconnected)
      socket.off('player-reconnected', handlePlayerReconnected)
      socket.off('game-ended', handleGameEnded)
      socket.off('error', handleSocketError)
    }
  }, [socket, gameId, playerId])

  const createGame = async () => {
    unlockAudio()
    setError('')
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          username: username.trim() || undefined
        })
      })
      const payload = await res.json()

      if (!res.ok || !payload.success) {
        setError(payload.error || 'Failed to create game')
        return
      }

      const createdGameId = payload.data.gameId
      setGameId(createdGameId)
      setGameIdInput(createdGameId)
      setPlayerColor('white')
      setGameStatus(payload.data.status || 'waiting')
      setGame(new Chess(payload.data.board?.fen || new Chess().fen()))
      setTurn('white')
      setGameHistory([])
      setOpponentConnected(false)

      socket?.emit('join-game', { gameId: createdGameId, playerId })
    } catch (e) {
      setError('Failed to create game room')
    }
  }

  const joinGame = async () => {
    unlockAudio()
    if (!gameIdInput.trim()) {
      setError('Enter a game ID to join')
      playIllegal()
      return
    }

    setError('')
    try {
      const targetGameId = gameIdInput.trim()
      const res = await fetch(`/api/games/${targetGameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          username: username.trim() || undefined
        })
      })
      const payload = await res.json()

      if (!res.ok || !payload.success) {
        setError(payload.error || 'Failed to join game')
        return
      }

      setGameId(targetGameId)
      setPlayerColor(payload.data.playerColor || 'black')
      setGameStatus(payload.data.status || 'active')
      setGame(new Chess(payload.data.board?.fen || new Chess().fen()))
      setTurn(payload.data.board?.currentTurn || 'white')

      socket?.emit('join-game', { gameId: targetGameId, playerId })
      socket?.emit('get-board', { gameId: targetGameId })
    } catch (e) {
      setError('Failed to join game room')
    }
  }

  const onPieceDrop = (source, target) => {
    unlockAudio()
    if (!socket || !gameId) return false
    if (!canMove) {
      setError('Wait for your turn')
      playIllegal()
      return false
    }

    // Client-side check for quick UX; server remains authoritative.
    const probeGame = new Chess(game.fen())
    const legalMove = probeGame.move({ from: source, to: target, promotion: 'q' })
    if (!legalMove) {
      setError('Illegal move')
      playIllegal()
      return false
    }

    setError('')
    socket.emit('move', {
      gameId,
      playerId,
      from: source,
      to: target,
      promotion: 'q'
    })

    return true
  }

  const boardOrientation = playerColor === 'white' ? 'white' : 'black'

  return (
    <div className="game-board-container">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Chessboard */}
        <div className="board-section">
          <div className="board-wrapper">
            <Chessboard
              position={game.fen()}
              onPieceDrop={onPieceDrop}
              boardOrientation={boardOrientation}
              customSquareStyles={{
                ...(lastMove && {
                  [lastMove.from]: { background: 'rgba(200, 200, 0, 0.3)' },
                  [lastMove.to]: { background: 'rgba(200, 200, 0, 0.3)' }
                })
              }}
              animationDuration={200}
              arePiecesDraggable={canMove}
              areArrowsAllowed={false}
              customDarkSquareStyle={{ backgroundColor: boardTheme.dark }}
              customLightSquareStyle={{ backgroundColor: boardTheme.light }}
            />
          </div>

          {/* Move history */}
          <div className="move-history">
            <h3 className="text-lg font-semibold text-white mb-3">Moves</h3>
            <div className="moves-list">
              {gameHistory.map((item, idx) => (
                <span key={idx} className="move-item">
                  {Math.floor(idx / 2) + 1}. {item.move || item.san || '-'}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Game controls and info */}
        <div className="control-section">
          <div className="info-panel">
            <div className="info-card">
              <h3 className="text-lg font-semibold text-white mb-2">Multiplayer Lobby</h3>
              <input
                type="text"
                placeholder="Your username (optional)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              />
              <input
                type="text"
                placeholder="Enter game ID"
                value={gameIdInput}
                onChange={(e) => setGameIdInput(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              />
              <button
                onClick={createGame}
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition mb-2"
              >
                Create Room
              </button>
              <button
                onClick={joinGame}
                disabled={!gameIdInput.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-500 transition mb-2"
              >
                Join Game
              </button>
              {gameId && (
                <div className="text-xs text-slate-300 break-all">Room: {gameId}</div>
              )}
              {error && (
                <div className="text-xs text-red-400 mt-2">{error}</div>
              )}
            </div>

            <div className="info-card">
              <h3 className="text-lg font-semibold text-white mb-2">Status</h3>
              <div className="space-y-2 text-sm">
                <div className={`px-3 py-2 rounded ${gameStatus === 'active' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                  {gameStatus === 'active' ? '✓ Game Active' : `⟳ ${gameStatus}`}
                </div>
                <div className="px-3 py-2 rounded bg-slate-700 text-slate-300">
                  Turn: <span className="font-semibold text-white">{turn}</span>
                </div>
                <div className="px-3 py-2 rounded bg-slate-700 text-slate-300">
                  You: <span className="font-semibold text-white capitalize">{playerColor}</span>
                </div>
                <div className="px-3 py-2 rounded bg-slate-700 text-slate-300">
                  Opponent: <span className={`font-semibold ${opponentConnected ? 'text-green-300' : 'text-yellow-300'}`}>{opponentConnected ? 'Online' : 'Offline'}</span>
                </div>
                <div className="px-3 py-2 rounded bg-slate-700 text-slate-300">
                  Can Move: <span className={`font-semibold ${canMove ? 'text-green-300' : 'text-yellow-300'}`}>{canMove ? 'Yes' : 'No'}</span>
                </div>
                {game.isCheck() && (
                  <div className="px-3 py-2 rounded bg-red-900 text-red-300">
                    ⚠ Check!
                  </div>
                )}
              </div>
            </div>

            <div className="info-card">
              <h3 className="text-lg font-semibold text-white mb-2">Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => socket?.emit('get-board', { gameId })}
                  disabled={!gameId}
                  className="w-full px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:bg-slate-500 transition text-sm"
                >
                  Sync Board
                </button>
                <button
                  onClick={() => socket?.emit('resign', { gameId, playerId })}
                  disabled={!gameId || gameStatus !== 'active'}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-slate-500 transition text-sm"
                >
                  Resign
                </button>
              </div>
            </div>

            <div className="info-card">
              <h3 className="text-lg font-semibold text-white mb-2">Game State</h3>
              <div className="space-y-1 text-xs text-slate-400 font-mono break-all">
                <div>Player ID: <span className="text-slate-300">{playerId.slice(0, 14)}...</span></div>
                <div>Total Moves: <span className="text-slate-300">{gameHistory.length}</span></div>
                <div>Check: <span className={game.isCheck() ? 'text-red-400' : 'text-green-400'}>{game.isCheck() ? 'Yes' : 'No'}</span></div>
                <div>Checkmate: <span className={game.isCheckmate() ? 'text-red-400' : 'text-green-400'}>{game.isCheckmate() ? 'Yes' : 'No'}</span></div>
                <div>Stalemate: <span className={game.isStalemate() ? 'text-yellow-400' : 'text-green-400'}>{game.isStalemate() ? 'Yes' : 'No'}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GameBoard
