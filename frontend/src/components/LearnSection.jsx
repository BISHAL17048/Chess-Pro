import { useEffect, useMemo, useState } from 'react'
import GameAnalysis from './GameAnalysis'
import LearnLessonView from './LearnLessonView'
import { fetchProgressOverview } from '../utils/progressApi'
import { fetchLichessLearn } from '../utils/lichessApi'

const LESSON_CATEGORIES = {
  basics: {
    id: 'basics',
    title: 'Chess Basics',
    subtitle: 'Master the fundamentals of chess',
    icon: '♟️',
    color: 'from-blue-500 to-blue-600',
    difficulty: 'beginner',
    estimatedTime: '2 hours',
    lessons: 24,
    progress: 0,
    stages: [
      { id: 'rook', title: 'The Rook', description: 'It moves in straight lines', difficulty: 1, completed: false },
      { id: 'bishop', title: 'The Bishop', description: 'It moves on diagonals', difficulty: 1, completed: false },
      { id: 'queen', title: 'The Queen', description: 'Queen = Rook + Bishop', difficulty: 1, completed: false },
      { id: 'king', title: 'The King', description: 'The most important piece', difficulty: 1, completed: false },
      { id: 'knight', title: 'The Knight', description: 'It moves in an L shape', difficulty: 1, completed: false },
      { id: 'pawn', title: 'The Pawn', description: 'It moves forward only', difficulty: 1, completed: false },
      { id: 'board_setup', title: 'Board Setup', description: 'How pieces are arranged', difficulty: 1, completed: false },
      { id: 'special_moves', title: 'Special Moves', description: 'Castling, en passant, promotion', difficulty: 2, completed: false }
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
    progress: 0,
    stages: [
      { id: 'capture', title: 'Capture', description: 'Take the enemy pieces', difficulty: 1, completed: false },
      { id: 'protection', title: 'Protection', description: 'Keep your pieces safe', difficulty: 1, completed: false },
      { id: 'fork', title: 'Fork', description: 'Attack two pieces at once', difficulty: 2, completed: false },
      { id: 'pin', title: 'Pin', description: 'Immobilize a piece', difficulty: 2, completed: false },
      { id: 'skewer', title: 'Skewer', description: 'Attack through a piece', difficulty: 2, completed: false },
      { id: 'discovered_attack', title: 'Discovered Attack', description: 'Reveal a powerful attack', difficulty: 3, completed: false },
      { id: 'deflection', title: 'Deflection', description: 'Force a piece away', difficulty: 3, completed: false },
      { id: 'overloading', title: 'Overloading', description: 'Overwork a defender', difficulty: 3, completed: false },
      { id: 'mate_in_one', title: 'Mate in One', description: 'Find the winning move', difficulty: 2, completed: false },
      { id: 'mate_in_two', title: 'Mate in Two', description: 'Plan a two-move combo', difficulty: 3, completed: false }
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
    progress: 0,
    stages: [
      { id: 'piece_value', title: 'Piece Value', description: 'Evaluate piece exchanges', difficulty: 1, completed: false },
      { id: 'center_control', title: 'Center Control', description: 'Dominate the middle', difficulty: 2, completed: false },
      { id: 'piece_development', title: 'Piece Development', description: 'Bring pieces into play', difficulty: 2, completed: false },
      { id: 'king_safety', title: 'King Safety', description: 'Protect your king', difficulty: 2, completed: false },
      { id: 'pawn_structure', title: 'Pawn Structure', description: 'Build strong pawn chains', difficulty: 3, completed: false },
      { id: 'open_files', title: 'Open Files', description: 'Use open lines effectively', difficulty: 3, completed: false },
      { id: 'outposts', title: 'Outposts', description: 'Place pieces on strong squares', difficulty: 3, completed: false },
      { id: 'prophylaxis', title: 'Prophylaxis', description: 'Prevent opponent plans', difficulty: 4, completed: false }
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
    progress: 0,
    stages: [
      { id: 'opposition', title: 'Opposition', description: 'King vs king positioning', difficulty: 2, completed: false },
      { id: 'passed_pawns', title: 'Passed Pawns', description: 'Promote pawns to queens', difficulty: 2, completed: false },
      { id: 'lucena', title: 'Lucena Position', description: 'Rook endgame win', difficulty: 3, completed: false },
      { id: 'philidor', title: 'Philidor Position', description: 'Rook endgame defense', difficulty: 3, completed: false },
      { id: 'queen_vs_pawn', title: 'Queen vs Pawn', description: 'Win with queen', difficulty: 2, completed: false },
      { id: 'rook_endgames', title: 'Rook Endgames', description: 'Common rook patterns', difficulty: 3, completed: false },
      { id: 'pawn_endgames', title: 'Pawn Endgames', description: 'King and pawn technique', difficulty: 3, completed: false },
      { id: 'fortress', title: 'Fortress', description: 'Hold difficult positions', difficulty: 4, completed: false }
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
    progress: 0,
    stages: [
      { id: 'opening_principles', title: 'Opening Principles', description: 'General opening guidelines', difficulty: 1, completed: false },
      { id: 'e4_openings', title: '1.e4 Openings', description: 'Open games', difficulty: 2, completed: false },
      { id: 'd4_openings', title: '1.d4 Openings', description: 'Closed games', difficulty: 2, completed: false },
      { id: 'italian_game', title: 'Italian Game', description: 'Classic 1.e4 e5', difficulty: 2, completed: false },
      { id: 'sicilian_defense', title: 'Sicilian Defense', description: 'Popular fighting defense', difficulty: 3, completed: false },
      { id: 'queens_gambit', title: 'Queen\'s Gambit', description: 'Classic 1.d4', difficulty: 2, completed: false },
      { id: 'kings_indian', title: 'King\'s Indian', description: 'Dynamic counter-attack', difficulty: 3, completed: false },
      { id: 'caro_kann', title: 'Caro-Kann', description: 'Solid defense', difficulty: 2, completed: false }
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
    progress: 0,
    stages: [
      { id: 'mate_in_1', title: 'Mate in 1', description: 'Quick checkmates', difficulty: 1, completed: false },
      { id: 'mate_in_2', title: 'Mate in 2', description: 'Two-move combinations', difficulty: 2, completed: false },
      { id: 'mate_in_3', title: 'Mate in 3', description: 'Three-move tactics', difficulty: 3, completed: false },
      { id: 'tactics', title: 'Tactics', description: 'All tactical themes', difficulty: 2, completed: false },
      { id: 'endgames', title: 'Endgame Puzzles', description: 'Endgame technique', difficulty: 3, completed: false },
      { id: 'advanced', title: 'Advanced', description: 'Complex positions', difficulty: 4, completed: false }
    ]
  }
}

const ACHIEVEMENTS = {
  first_lesson: { id: 'first_lesson', title: 'First Steps', description: 'Complete your first lesson', icon: '🎯', rarity: 'common', unlocked: false },
  basics_master: { id: 'basics_master', title: 'Basics Master', description: 'Complete all basics lessons', icon: '🌟', rarity: 'rare', unlocked: false },
  tactics_expert: { id: 'tactics_expert', title: 'Tactics Expert', description: 'Complete all tactics lessons', icon: '⚔️', rarity: 'rare', unlocked: false },
  puzzle_master: { id: 'puzzle_master', title: 'Puzzle Master', description: 'Solve 100 puzzles', icon: '🧩', rarity: 'epic', unlocked: false },
  endgame_king: { id: 'endgame_king', title: 'Endgame King', description: 'Complete all endgame lessons', icon: '👑', rarity: 'epic', unlocked: false },
  opening_scholar: { id: 'opening_scholar', title: 'Opening Scholar', description: 'Complete all opening lessons', icon: '📚', rarity: 'epic', unlocked: false },
  perfect_score: { id: 'perfect_score', title: 'Perfect Score', description: 'Complete a lesson with no mistakes', icon: '💯', rarity: 'legendary', unlocked: false },
  speed_demon: { id: 'speed_demon', title: 'Speed Demon', description: 'Complete 5 lessons in one day', icon: '⚡', rarity: 'rare', unlocked: false },
  consistency: { id: 'consistency', title: 'Consistent Learner', description: 'Study for 7 days in a row', icon: '🔥', rarity: 'rare', unlocked: false },
  grandmaster: { id: 'grandmaster', title: 'Grandmaster', description: 'Complete all lessons', icon: '🏆', rarity: 'legendary', unlocked: false }
}

const SKILL_RATINGS = {
  tactics: { name: 'Tactics', rating: 800, maxRating: 2000, color: 'text-red-400' },
  strategy: { name: 'Strategy', rating: 750, maxRating: 2000, color: 'text-purple-400' },
  endgames: { name: 'Endgames', rating: 700, maxRating: 2000, color: 'text-amber-400' },
  openings: { name: 'Openings', rating: 720, maxRating: 2000, color: 'text-emerald-400' }
}

function LearnSection({ socket, onPuzzlesClick }) {
  const [activeMode, setActiveMode] = useState('categories')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [persistedProgress, setPersistedProgress] = useState(null)
  const [learnFeed, setLearnFeed] = useState([])
  const [learnPageMeta, setLearnPageMeta] = useState(null)
  const [learnFeedLoading, setLearnFeedLoading] = useState(false)
  const [learnFeedError, setLearnFeedError] = useState('')
  const [categories, setCategories] = useState(LESSON_CATEGORIES)
  const [achievements, setAchievements] = useState(ACHIEVEMENTS)
  const [skillRatings, setSkillRatings] = useState(SKILL_RATINGS)
  const [showAchievements, setShowAchievements] = useState(false)

  const totalProgress = useMemo(() => {
    const totalLessons = Object.values(categories).reduce((acc, cat) => acc + cat.lessons, 0)
    const completedLessons = Object.values(categories).reduce((acc, cat) => {
      const completed = cat.stages.filter(s => s.completed).length
      return acc + completed
    }, 0)
    return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
  }, [categories])

  const unlockedAchievements = useMemo(() => {
    return Object.values(achievements).filter(a => a.unlocked).length
  }, [achievements])

  useEffect(() => {
    let active = true
    fetchProgressOverview()
      .then((data) => {
        if (!active || !data) return
        setPersistedProgress(data)
      })
      .catch(() => {
        // Optional persistence: ignore when user is unauthenticated.
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setLearnFeedLoading(true)
    setLearnFeedError('')

    fetchLichessLearn()
      .then((payload) => {
        if (!active) return
        const modules = Array.isArray(payload?.modules) ? payload.modules : []
        setLearnFeed(modules)
        setLearnPageMeta(payload?.page || null)
      })
      .catch((error) => {
        if (!active) return
        setLearnFeed([])
        setLearnPageMeta(null)
        setLearnFeedError(error?.message || 'Unable to load live learn content.')
      })
      .finally(() => {
        if (!active) return
        setLearnFeedLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const handleCategoryClick = (categoryId) => {
    setSelectedCategory(categories[categoryId])
    setActiveMode('lessons')
  }

  const handleLessonClick = (lesson) => {
    setSelectedLesson(lesson)
    setActiveMode('lesson')
  }

  const handleBackToCategories = () => {
    setSelectedCategory(null)
    setActiveMode('categories')
  }

  const handleBackToLessons = () => {
    setSelectedLesson(null)
    setActiveMode('lessons')
  }

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'beginner': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      case 'intermediate': return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      case 'advanced': return 'bg-rose-500/15 text-rose-300 border-rose-500/30'
      case 'all': return 'bg-purple-500/15 text-purple-300 border-purple-500/30'
      default: return 'bg-slate-500/15 text-slate-300 border-slate-500/30'
    }
  }

  // Icon components
  const ChessIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 16l-1.447.724a1 1 0 0 0-.553.894V20h12v-2.382a1 1 0 0 0-.553-.894L16 16H8z"/>
      <path d="M12 4a4 4 0 0 0-4 4 4 4 0 0 0 4 4 4 4 0 0 0 4-4 4 4 0 0 0-4-4"/>
      <path d="M12 8v8"/>
      <path d="M8 16h8"/>
    </svg>
  )

  const SwordIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5"/>
      <path d="m13 19 6-6"/>
      <path d="m16 16 4 4"/>
      <path d="m19 21 2-2"/>
    </svg>
  )

  const BrainIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
    </svg>
  )

  const TrophyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  )

  const BookIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
    </svg>
  )

  const PuzzleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M9 13l2 2 4-4"/>
    </svg>
  )

  const getCategoryIcon = (iconName) => {
    switch (iconName) {
      case '♟️': return <ChessIcon />
      case '⚔️': return <SwordIcon />
      case '🧠': return <BrainIcon />
      case '🏆': return <TrophyIcon />
      case '📖': return <BookIcon />
      case '🧩': return <PuzzleIcon />
      default: return <ChessIcon />
    }
  }

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common': return 'border-slate-500/50 bg-slate-500/10'
      case 'rare': return 'border-blue-500/50 bg-blue-500/10'
      case 'epic': return 'border-purple-500/50 bg-purple-500/10'
      case 'legendary': return 'border-amber-500/50 bg-amber-500/10'
      default: return 'border-slate-500/50 bg-slate-500/10'
    }
  }

  if (activeMode === 'lesson' && selectedLesson) {
    return <LearnLessonView lesson={selectedLesson} onBack={handleBackToLessons} />
  }

  return (
    <div className='chess-page'>
      <section className='chess-card'>
        {/* Hero Section */}
        <div className='mb-6 overflow-hidden rounded-2xl border border-cyan-300/20 bg-[radial-gradient(120%_120%_at_10%_0%,rgba(34,211,238,0.23)_0%,rgba(15,23,42,0.2)_45%,rgba(2,6,23,0.15)_100%)] p-6'>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div className='flex-1'>
              <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/90'>Chess Learning Center</p>
              <h2 className='mt-2 text-3xl font-bold text-white'>Master Chess</h2>
              <p className='mt-2 max-w-2xl text-sm text-slate-300'>
                Comprehensive lessons from basics to grandmaster level. Track your progress, earn achievements, and improve your skills.
              </p>
            </div>
            <div className='flex gap-4'>
              <div className='rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-5 py-3 text-center min-w-[120px]'>
                <p className='text-[11px] uppercase tracking-wide text-cyan-200'>Progress</p>
                <p className='text-2xl font-bold text-white'>{totalProgress}%</p>
              </div>
              <div className='rounded-xl border border-amber-300/25 bg-amber-500/10 px-5 py-3 text-center min-w-[120px]'>
                <p className='text-[11px] uppercase tracking-wide text-amber-200'>Achievements</p>
                <p className='text-2xl font-bold text-white'>{unlockedAchievements}/10</p>
              </div>
            </div>
          </div>
        </div>

        {/* Skill Ratings */}
        <div className='mb-6 rounded-2xl border border-white/10 bg-[#252525] p-5'>
          <h3 className='text-xs font-bold uppercase tracking-[0.15em] text-cyan-300/80 mb-4'>Skill Ratings</h3>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
            {Object.entries(skillRatings).map(([key, skill]) => (
              <div key={key} className='rounded-xl bg-[#1a1a1a] p-4'>
                <div className='flex items-center justify-between mb-3'>
                  <span className={`text-sm font-bold ${skill.color}`}>{skill.name}</span>
                  <span className='text-xs text-slate-500'>{skill.rating}/{skill.maxRating}</span>
                </div>
                <div className='h-2.5 bg-slate-800 rounded-full overflow-hidden'>
                  <div 
                    className={`h-full ${skill.color.replace('text-', 'bg-')} rounded-full transition-all duration-500`}
                    style={{ width: `${(skill.rating / skill.maxRating) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className='mb-6 flex flex-wrap gap-2'>
          <button
            onClick={() => setActiveMode('categories')}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${activeMode === 'categories' ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' : 'border-white/10 bg-[#1a1a1a] text-slate-400 hover:border-white/20 hover:text-slate-200'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeMode === 'categories' ? 'text-cyan-400' : 'text-slate-500'}>
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Categories
          </button>
          <button
            onClick={() => setActiveMode('practice')}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${activeMode === 'practice' ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' : 'border-white/10 bg-[#1a1a1a] text-slate-400 hover:border-white/20 hover:text-slate-200'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeMode === 'practice' ? 'text-cyan-400' : 'text-slate-500'}>
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
            Practice
          </button>
          <button
            onClick={() => setActiveMode('puzzles')}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${activeMode === 'puzzles' ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' : 'border-white/10 bg-[#1a1a1a] text-slate-400 hover:border-white/20 hover:text-slate-200'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeMode === 'puzzles' ? 'text-cyan-400' : 'text-slate-500'}>
              <path d="M4 7V4h3"/><path d="M4 17v3h3"/><path d="M20 7V4h-3"/><path d="M20 17v3h-3"/><path d="M9 9h6v6H9z"/>
            </svg>
            Puzzles
          </button>
          <button
            onClick={() => setShowAchievements(!showAchievements)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${showAchievements ? 'border-amber-500/50 bg-amber-500/10 text-amber-300' : 'border-white/10 bg-[#1a1a1a] text-slate-400 hover:border-white/20 hover:text-slate-200'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={showAchievements ? 'text-amber-400' : 'text-slate-500'}>
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
              <path d="M4 22h16"/>
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
            Achievements
          </button>
        </div>

        {/* Achievements Panel */}
        {showAchievements && (
          <div className='mb-6 rounded-2xl border border-amber-500/20 bg-[#2a2520] p-5'>
            <h3 className='text-xs font-bold uppercase tracking-[0.15em] text-amber-300/80 mb-4'>Achievements</h3>
            <div className='grid grid-cols-2 md:grid-cols-5 gap-3'>
              {Object.values(achievements).map((achievement) => (
                <div 
                  key={achievement.id}
                  className={`rounded-xl p-4 text-center transition ${achievement.unlocked ? 'bg-[#1f1c18]' : 'bg-[#1f1c18] opacity-40'}`}
                >
                  <div className={`text-3xl mb-3 ${achievement.unlocked ? '' : 'grayscale'}`}>{achievement.icon}</div>
                  <p className='text-xs font-bold text-white mb-1'>{achievement.title}</p>
                  <p className='text-[10px] text-slate-500 leading-tight'>{achievement.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categories View */}
        {activeMode === 'categories' && !selectedCategory && (
          <div>
            <div className='mb-6 flex items-center justify-between'>
              <h3 className='text-xl font-bold text-white'>Learning Paths</h3>
              <span className='text-sm text-slate-400'>{Object.keys(categories).length} courses available</span>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {Object.values(categories).map((category) => (
                <article 
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className='group cursor-pointer rounded-2xl border border-white/10 bg-[#1a1a1a] p-5 transition-all duration-300 hover:border-white/20 hover:bg-[#222222] hover:-translate-y-1'
                >
                  <div className='mb-4 flex items-start justify-between'>
                    <div className={`w-12 h-12 rounded-xl ${category.color.replace('from-', 'bg-').replace(' to-', '-').split('-')[0]}/20 flex items-center justify-center`}>
                      <div className={`${category.color.replace('from-', 'text-').replace(' to-', '-').split('-')[0]}-400`}>
                        {getCategoryIcon(category.icon)}
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-semibold border ${getDifficultyColor(category.difficulty)}`}>
                      {category.difficulty}
                    </span>
                  </div>
                  <h4 className='text-lg font-bold text-white mb-1 group-hover:text-cyan-300 transition-colors'>
                    {category.title}
                  </h4>
                  <p className='text-sm text-slate-400 mb-4 line-clamp-2'>{category.subtitle}</p>
                  <div className='flex items-center justify-between mb-4'>
                    <span className='text-xs text-slate-500'>{category.lessons} lessons</span>
                    <span className='text-xs text-slate-500'>{category.estimatedTime}</span>
                  </div>
                  <div className='h-2 bg-slate-800 rounded-full overflow-hidden mb-3'>
                    <div 
                      className={`h-full bg-gradient-to-r ${category.color} transition-all duration-500`}
                      style={{ width: `${category.progress}%` }}
                    />
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-xs text-slate-500'>{category.progress}% complete</span>
                    <span className='text-sm font-semibold text-cyan-400 flex items-center gap-1 group-hover:gap-2 transition-all'>
                      Start <span>→</span>
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* Lessons View */}
        {activeMode === 'lessons' && selectedCategory && (
          <div>
            <button 
              onClick={handleBackToCategories}
              className='mb-4 flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition'
            >
              <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4' viewBox='0 0 20 20' fill='currentColor'>
                <path fillRule='evenodd' d='M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z' clipRule='evenodd' />
              </svg>
              Back to Categories
            </button>
            
            <div className={`mb-4 rounded-xl border border-white/10 bg-gradient-to-br ${selectedCategory.color} p-6`}>
              <div className='flex items-center gap-4'>
                <div className='w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center text-3xl'>
                  {selectedCategory.icon}
                </div>
                <div className='flex-1'>
                  <h2 className='text-2xl font-bold text-white'>{selectedCategory.title}</h2>
                  <p className='text-sm text-white/80'>{selectedCategory.subtitle}</p>
                </div>
                <div className='text-right'>
                  <p className='text-3xl font-bold text-white'>{selectedCategory.progress}%</p>
                  <p className='text-xs text-white/70'>{selectedCategory.stages.filter(s => s.completed).length}/{selectedCategory.stages.length} completed</p>
                </div>
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              {selectedCategory.stages.map((stage, idx) => (
                <div 
                  key={stage.id}
                  onClick={() => handleLessonClick(stage)}
                  className={`group cursor-pointer rounded-lg border p-4 transition ${
                    stage.completed 
                      ? 'border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-500/50' 
                      : 'border-white/10 bg-[#2d2d30] hover:border-cyan-300/35 hover:bg-[#333338]'
                  }`}
                >
                  <div className='flex items-start justify-between mb-2'>
                    <div className='flex items-center gap-3'>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        stage.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'
                      }`}>
                        {stage.completed ? '✓' : idx + 1}
                      </div>
                      <div>
                        <h4 className='text-sm font-semibold text-white'>{stage.title}</h4>
                        <p className='text-xs text-slate-400'>{stage.description}</p>
                      </div>
                    </div>
                    <span className={`rounded border px-2 py-0.5 text-[10px] ${getDifficultyColor(`beginner`)}`}>
                      Lvl {stage.difficulty}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Practice Mode */}
        {activeMode === 'practice' && (
          <div>
            <GameAnalysis socket={socket} hideLiveOptions />
          </div>
        )}

        {/* Puzzles Mode */}
        {activeMode === 'puzzles' && (
          <div className='rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-6 text-center'>
            <div className='text-4xl mb-4'>🧩</div>
            <h3 className='text-xl font-bold text-white mb-2'>Puzzle Training</h3>
            <p className='text-slate-300 mb-4'>Sharpen your tactical vision with thousands of puzzles</p>
            <button
              onClick={() => {
                if (typeof onPuzzlesClick === 'function') onPuzzlesClick()
              }}
              className='rounded-lg border border-emerald-300/40 px-6 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15'
            >
              Start Puzzle Rush
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

export default LearnSection
