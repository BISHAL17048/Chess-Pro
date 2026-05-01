import mongoose from 'mongoose'

const archivedMoveSchema = new mongoose.Schema(
  {
    ply: { type: Number, required: true },
    san: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    color: { type: String, enum: ['white', 'black'], required: true },
    piece: { type: String, default: null },
    captured: { type: String, default: null },
    promotion: { type: String, default: null },
    fen: { type: String, required: true },
    timestamp: { type: Date, default: null }
  },
  { _id: false }
)

const moveAnalysisSchema = new mongoose.Schema(
  {
    ply: { type: Number, required: true },
    san: { type: String, required: true },
    byColor: { type: String, enum: ['white', 'black'], required: true },
    fenBefore: { type: String, required: true },
    fenAfter: { type: String, required: true },
    materialBefore: { type: Number, required: true },
    materialAfter: { type: Number, required: true },
    materialDelta: { type: Number, required: true },
    advantageCp: { type: Number, required: true },
    tags: [{ type: String }]
  },
  { _id: false }
)

const gameRecordSchema = new mongoose.Schema(
  {
    gameId: { type: String, required: true, unique: true, index: true },
    status: { type: String, required: true },
    result: { type: String, default: null },
    reason: { type: String, default: null },
    gameMode: { type: String, default: 'casual' },
    rated: { type: Boolean, default: false },
    variant: { type: String, default: 'standard' },
    timeControl: {
      preset: { type: String, default: '5+0' },
      category: { type: String, default: 'blitz' },
      baseTimeMs: { type: Number, default: 300000 },
      incrementMs: { type: Number, default: 0 },
      label: { type: String, default: '5+0' }
    },
    whitePlayer: {
      userId: { type: String, required: true, index: true },
      username: { type: String, required: true },
      email: { type: String, default: null }
    },
    blackPlayer: {
      userId: { type: String, required: true, index: true },
      username: { type: String, required: true },
      email: { type: String, default: null }
    },
    initialFen: { type: String, required: true },
    finalFen: { type: String, required: true },
    pgn: { type: String, default: '' },
    moveCount: { type: Number, default: 0 },
    moves: [archivedMoveSchema],
    analysis: {
      summary: {
        winner: { type: String, default: 'none' },
        openingPhasePlies: { type: Number, default: 0 },
        middlegamePhasePlies: { type: Number, default: 0 },
        endgamePhasePlies: { type: Number, default: 0 },
        maxMaterialSwing: { type: Number, default: 0 },
        finalMaterialBalance: { type: Number, default: 0 },
        notes: [{ type: String }]
      },
      timeline: [moveAnalysisSchema]
    },
    drawDetection: {
      is_draw: { type: Boolean, default: false },
      type: { type: String, default: null },
      automatic: { type: Boolean, default: false },
      description: { type: String, default: null }
    },
    createdAtGame: { type: Date, default: null },
    startedAtGame: { type: Date, default: null },
    endedAtGame: { type: Date, default: null }
  },
  {
    timestamps: true
  }
)

gameRecordSchema.index({ 'whitePlayer.userId': 1, endedAtGame: -1 })
gameRecordSchema.index({ 'blackPlayer.userId': 1, endedAtGame: -1 })
gameRecordSchema.index({ 'whitePlayer.email': 1, endedAtGame: -1 })
gameRecordSchema.index({ 'blackPlayer.email': 1, endedAtGame: -1 })

const GameRecord = mongoose.model('GameRecord', gameRecordSchema)

export default GameRecord
