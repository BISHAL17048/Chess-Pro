import { create } from 'zustand'
import { Chess } from 'chess.js'

const INITIAL_TIMERS = { white: 300, black: 300 }
const INITIAL_CHAT = [
  { id: 1, sender: 'Nadia', text: 'Good luck. No mercy today.' },
  { id: 2, sender: 'You', text: 'Bring it on.' }
]

export const usePlayStore = create((set) => ({
  initialFen: new Chess().fen(),
  fen: new Chess().fen(),
  moves: [],
  lastMove: null,
  reviewIntent: null,
  chat: INITIAL_CHAT,
  timers: INITIAL_TIMERS,
  running: true,

  applyPosition: ({ fen, moves, lastMove }) =>
    set({
      fen,
      moves,
      lastMove
    }),

  setTimers: (timers) =>
    set({
      timers: {
        white: timers?.white ?? 300,
        black: timers?.black ?? 300
      }
    }),

  tickTimer: (turn) =>
    set((state) => {
      const next = Math.max(0, state.timers[turn] - 1)
      return {
        timers: {
          ...state.timers,
          [turn]: next
        }
      }
    }),

  toggleRunning: () => set((state) => ({ running: !state.running })),

  addChatMessage: (sender, text) =>
    set((state) => ({
      chat: [...state.chat, { id: Date.now(), sender, text }]
    })),

  loadGameForReview: ({ initialFen, fen, moves, gameId, whitePlayer, blackPlayer, whiteEmail, blackEmail, pgn, endedAt, result, reason }) =>
    set({
      initialFen: initialFen || new Chess().fen(),
      fen: fen || initialFen || new Chess().fen(),
      moves: Array.isArray(moves) ? moves : [],
      reviewIntent: {
        gameId: gameId || null,
        whitePlayer: whitePlayer || 'White',
        blackPlayer: blackPlayer || 'Black',
        whiteEmail: whiteEmail || '',
        blackEmail: blackEmail || '',
        pgn: pgn || '',
        endedAt: endedAt || null,
        result: result || null,
        reason: reason || null,
        initialFen: initialFen || new Chess().fen(),
        fen: fen || initialFen || new Chess().fen(),
        moves: Array.isArray(moves) ? moves : []
      },
      lastMove: Array.isArray(moves) && moves.length
        ? {
            from: moves[moves.length - 1].from,
            to: moves[moves.length - 1].to
          }
        : null
    }),

  clearReviewIntent: () => set({ reviewIntent: null }),

  resetBoard: () =>
    set({
      initialFen: new Chess().fen(),
      fen: new Chess().fen(),
      moves: [],
      lastMove: null,
      reviewIntent: null,
      timers: INITIAL_TIMERS,
      running: true,
      chat: INITIAL_CHAT
    })
}))
