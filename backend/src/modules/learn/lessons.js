export const LESSON_CATEGORIES = {
  basics: {
    id: 'basics',
    title: 'Chess Basics',
    subtitle: 'Master the fundamentals of chess',
    icon: '♟️',
    color: 'from-blue-500 to-blue-600',
    difficulty: 'beginner',
    estimatedTime: '2 hours',
    lessons: 24,
    stages: [
      { id: 'rook', title: 'The Rook', description: 'It moves in straight lines', difficulty: 1 },
      { id: 'bishop', title: 'The Bishop', description: 'It moves on diagonals', difficulty: 1 },
      { id: 'queen', title: 'The Queen', description: 'Queen = Rook + Bishop', difficulty: 1 },
      { id: 'king', title: 'The King', description: 'The most important piece', difficulty: 1 },
      { id: 'knight', title: 'The Knight', description: 'It moves in an L shape', difficulty: 1 },
      { id: 'pawn', title: 'The Pawn', description: 'It moves forward only', difficulty: 1 },
      { id: 'board_setup', title: 'Board Setup', description: 'How pieces are arranged', difficulty: 1 },
      { id: 'special_moves', title: 'Special Moves', description: 'Castling, en passant, promotion', difficulty: 2 }
    ]
  },
  tactics: {
    id: 'tactics',
    title: 'Tactics',
    subtitle: 'Win material with tactical patterns',
    icon: '⚔️',
    color: 'from-red-500 to-red-600',
    difficulty: 'intermediate',
    estimatedTime: '4 hours',
    lessons: 36,
    stages: [
      { id: 'capture', title: 'Capture', description: 'Take the enemy pieces', difficulty: 1 },
      { id: 'protection', title: 'Protection', description: 'Keep your pieces safe', difficulty: 1 },
      { id: 'fork', title: 'Fork', description: 'Attack two pieces at once', difficulty: 2 },
      { id: 'pin', title: 'Pin', description: 'Immobilize a piece', difficulty: 2 },
      { id: 'skewer', title: 'Skewer', description: 'Attack through a piece', difficulty: 2 },
      { id: 'discovered_attack', title: 'Discovered Attack', description: 'Reveal a powerful attack', difficulty: 3 },
      { id: 'deflection', title: 'Deflection', description: 'Force a piece away', difficulty: 3 },
      { id: 'overloading', title: 'Overloading', description: 'Overwork a defender', difficulty: 3 },
      { id: 'mate_in_one', title: 'Mate in One', description: 'Find the winning move', difficulty: 2 },
      { id: 'mate_in_two', title: 'Mate in Two', description: 'Plan a two-move combo', difficulty: 3 }
    ]
  },
  strategy: {
    id: 'strategy',
    title: 'Strategy',
    subtitle: 'Build long-term advantages',
    icon: '🧠',
    color: 'from-purple-500 to-purple-600',
    difficulty: 'intermediate',
    estimatedTime: '5 hours',
    lessons: 30,
    stages: [
      { id: 'piece_value', title: 'Piece Value', description: 'Evaluate piece exchanges', difficulty: 1 },
      { id: 'center_control', title: 'Center Control', description: 'Dominate the middle', difficulty: 2 },
      { id: 'piece_development', title: 'Piece Development', description: 'Bring pieces into play', difficulty: 2 },
      { id: 'king_safety', title: 'King Safety', description: 'Protect your king', difficulty: 2 },
      { id: 'pawn_structure', title: 'Pawn Structure', description: 'Build strong pawn chains', difficulty: 3 },
      { id: 'open_files', title: 'Open Files', description: 'Use open lines effectively', difficulty: 3 },
      { id: 'outposts', title: 'Outposts', description: 'Place pieces on strong squares', difficulty: 3 },
      { id: 'prophylaxis', title: 'Prophylaxis', description: 'Prevent opponent plans', difficulty: 4 }
    ]
  },
  endgames: {
    id: 'endgames',
    title: 'Endgames',
    subtitle: 'Convert advantages into wins',
    icon: '🏆',
    color: 'from-amber-500 to-amber-600',
    difficulty: 'advanced',
    estimatedTime: '6 hours',
    lessons: 28,
    stages: [
      { id: 'opposition', title: 'Opposition', description: 'King vs king positioning', difficulty: 2 },
      { id: 'passed_pawns', title: 'Passed Pawns', description: 'Promote pawns to queens', difficulty: 2 },
      { id: 'lucena', title: 'Lucena Position', description: 'Rook endgame win', difficulty: 3 },
      { id: 'philidor', title: 'Philidor Position', description: 'Rook endgame defense', difficulty: 3 },
      { id: 'queen_vs_pawn', title: 'Queen vs Pawn', description: 'Win with queen', difficulty: 2 },
      { id: 'rook_endgames', title: 'Rook Endgames', description: 'Common rook patterns', difficulty: 3 },
      { id: 'pawn_endgames', title: 'Pawn Endgames', description: 'King and pawn technique', difficulty: 3 },
      { id: 'fortress', title: 'Fortress', description: 'Hold difficult positions', difficulty: 4 }
    ]
  },
  openings: {
    id: 'openings',
    title: 'Openings',
    subtitle: 'Start your games with confidence',
    icon: '📖',
    color: 'from-emerald-500 to-emerald-600',
    difficulty: 'intermediate',
    estimatedTime: '8 hours',
    lessons: 40,
    stages: [
      { id: 'opening_principles', title: 'Opening Principles', description: 'General opening guidelines', difficulty: 1 },
      { id: 'e4_openings', title: '1.e4 Openings', description: 'Open games', difficulty: 2 },
      { id: 'd4_openings', title: '1.d4 Openings', description: 'Closed games', difficulty: 2 },
      { id: 'italian_game', title: 'Italian Game', description: 'Classic 1.e4 e5', difficulty: 2 },
      { id: 'sicilian_defense', title: 'Sicilian Defense', description: 'Popular fighting defense', difficulty: 3 },
      { id: 'queens_gambit', title: 'Queen\'s Gambit', description: 'Classic 1.d4', difficulty: 2 },
      { id: 'kings_indian', title: 'King\'s Indian', description: 'Dynamic counter-attack', difficulty: 3 },
      { id: 'caro_kann', title: 'Caro-Kann', description: 'Solid defense', difficulty: 2 }
    ]
  },
  puzzles: {
    id: 'puzzles',
    title: 'Puzzle Training',
    subtitle: 'Sharpen your tactical vision',
    icon: '🧩',
    color: 'from-cyan-500 to-cyan-600',
    difficulty: 'all',
    estimatedTime: 'Unlimited',
    lessons: 1000,
    stages: [
      { id: 'mate_in_1', title: 'Mate in 1', description: 'Quick checkmates', difficulty: 1 },
      { id: 'mate_in_2', title: 'Mate in 2', description: 'Two-move combinations', difficulty: 2 },
      { id: 'mate_in_3', title: 'Mate in 3', description: 'Three-move tactics', difficulty: 3 },
      { id: 'tactics', title: 'Tactics', description: 'All tactical themes', difficulty: 2 },
      { id: 'endgames', title: 'Endgame Puzzles', description: 'Endgame technique', difficulty: 3 },
      { id: 'advanced', title: 'Advanced', description: 'Complex positions', difficulty: 4 }
    ]
  }
}

export const ACHIEVEMENTS = {
  first_lesson: { id: 'first_lesson', title: 'First Steps', description: 'Complete your first lesson', icon: '🎯', rarity: 'common' },
  basics_master: { id: 'basics_master', title: 'Basics Master', description: 'Complete all basics lessons', icon: '🌟', rarity: 'rare' },
  tactics_expert: { id: 'tactics_expert', title: 'Tactics Expert', description: 'Complete all tactics lessons', icon: '⚔️', rarity: 'rare' },
  puzzle_master: { id: 'puzzle_master', title: 'Puzzle Master', description: 'Solve 100 puzzles', icon: '🧩', rarity: 'epic' },
  endgame_king: { id: 'endgame_king', title: 'Endgame King', description: 'Complete all endgame lessons', icon: '👑', rarity: 'epic' },
  opening_scholar: { id: 'opening_scholar', title: 'Opening Scholar', description: 'Complete all opening lessons', icon: '📚', rarity: 'epic' },
  perfect_score: { id: 'perfect_score', title: 'Perfect Score', description: 'Complete a lesson with no mistakes', icon: '💯', rarity: 'legendary' },
  speed_demon: { id: 'speed_demon', title: 'Speed Demon', description: 'Complete 5 lessons in one day', icon: '⚡', rarity: 'rare' },
  consistency: { id: 'consistency', title: 'Consistent Learner', description: 'Study for 7 days in a row', icon: '🔥', rarity: 'rare' },
  grandmaster: { id: 'grandmaster', title: 'Grandmaster', description: 'Complete all lessons', icon: '🏆', rarity: 'legendary' }
}

export const SKILL_RATINGS = {
  tactics: { name: 'Tactics', rating: 0, maxRating: 2000 },
  strategy: { name: 'Strategy', rating: 0, maxRating: 2000 },
  endgames: { name: 'Endgames', rating: 0, maxRating: 2000 },
  openings: { name: 'Openings', rating: 0, maxRating: 2000 }
}

export function getAllLessons() {
  return Object.values(LESSON_CATEGORIES)
}

export function getLessonCategory(categoryId) {
  return LESSON_CATEGORIES[categoryId]
}
