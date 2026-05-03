import { useEffect, useMemo, useState } from 'react'
import GameAnalysis from './GameAnalysis'
import LearnLessonView from './LearnLessonView'
import { fetchProgressOverview } from '../utils/progressApi'

const LESSON_CATEGORIES = {
  basics:   { id:'basics',   title:'Chess Basics',     subtitle:'Master the fundamentals',          icon:'♟️', color:'from-blue-500 to-blue-600',   difficulty:'beginner',     estimatedTime:'2 hours',    lessons:24, progress:0, stages:[{id:'rook',title:'The Rook',description:'Moves in straight lines',difficulty:1,completed:false},{id:'bishop',title:'The Bishop',description:'Moves on diagonals',difficulty:1,completed:false},{id:'queen',title:'The Queen',description:'Queen = Rook + Bishop',difficulty:1,completed:false},{id:'king',title:'The King',description:'The most important piece',difficulty:1,completed:false},{id:'knight',title:'The Knight',description:'Moves in an L shape',difficulty:1,completed:false},{id:'pawn',title:'The Pawn',description:'Moves forward only',difficulty:1,completed:false},{id:'board_setup',title:'Board Setup',description:'How pieces are arranged',difficulty:1,completed:false},{id:'special_moves',title:'Special Moves',description:'Castling, en passant, promotion',difficulty:2,completed:false}] },
  tactics:  { id:'tactics',  title:'Tactics',          subtitle:'Win material with patterns',        icon:'⚔️', color:'from-red-500 to-red-600',     difficulty:'intermediate', estimatedTime:'4 hours',    lessons:36, progress:0, stages:[{id:'capture',title:'Capture',description:'Take enemy pieces',difficulty:1,completed:false},{id:'protection',title:'Protection',description:'Keep pieces safe',difficulty:1,completed:false},{id:'fork',title:'Fork',description:'Attack two pieces at once',difficulty:2,completed:false},{id:'pin',title:'Pin',description:'Immobilize a piece',difficulty:2,completed:false},{id:'skewer',title:'Skewer',description:'Attack through a piece',difficulty:2,completed:false},{id:'discovered_attack',title:'Discovered Attack',description:'Reveal a hidden attack',difficulty:3,completed:false},{id:'deflection',title:'Deflection',description:'Force a piece away',difficulty:3,completed:false},{id:'overloading',title:'Overloading',description:'Overwork a defender',difficulty:3,completed:false},{id:'mate_in_one',title:'Mate in One',description:'Find the winning move',difficulty:2,completed:false},{id:'mate_in_two',title:'Mate in Two',description:'Plan a two-move combo',difficulty:3,completed:false}] },
  strategy: { id:'strategy', title:'Strategy',         subtitle:'Build long-term advantages',        icon:'🧠', color:'from-purple-500 to-purple-600',difficulty:'intermediate', estimatedTime:'5 hours',    lessons:30, progress:0, stages:[{id:'piece_value',title:'Piece Value',description:'Evaluate exchanges',difficulty:1,completed:false},{id:'center_control',title:'Center Control',description:'Dominate the middle',difficulty:2,completed:false},{id:'piece_development',title:'Development',description:'Bring pieces into play',difficulty:2,completed:false},{id:'king_safety',title:'King Safety',description:'Protect your king',difficulty:2,completed:false},{id:'pawn_structure',title:'Pawn Structure',description:'Build strong pawn chains',difficulty:3,completed:false},{id:'open_files',title:'Open Files',description:'Use open lines',difficulty:3,completed:false},{id:'outposts',title:'Outposts',description:'Strong squares',difficulty:3,completed:false},{id:'prophylaxis',title:'Prophylaxis',description:'Prevent opponent plans',difficulty:4,completed:false}] },
  endgames: { id:'endgames', title:'Endgames',         subtitle:'Convert advantages into wins',      icon:'🏆', color:'from-amber-500 to-amber-600', difficulty:'advanced',     estimatedTime:'6 hours',    lessons:28, progress:0, stages:[{id:'opposition',title:'Opposition',description:'King positioning',difficulty:2,completed:false},{id:'passed_pawns',title:'Passed Pawns',description:'Promote pawns',difficulty:2,completed:false},{id:'lucena',title:'Lucena',description:'Rook endgame win',difficulty:3,completed:false},{id:'philidor',title:'Philidor',description:'Rook defense',difficulty:3,completed:false},{id:'queen_vs_pawn',title:'Queen vs Pawn',description:'Win with queen',difficulty:2,completed:false},{id:'rook_endgames',title:'Rook Endgames',description:'Common patterns',difficulty:3,completed:false},{id:'pawn_endgames',title:'Pawn Endgames',description:'King technique',difficulty:3,completed:false},{id:'fortress',title:'Fortress',description:'Hold difficult positions',difficulty:4,completed:false}] },
  openings: { id:'openings', title:'Openings',         subtitle:'Start games with confidence',       icon:'📖', color:'from-emerald-500 to-emerald-600',difficulty:'intermediate',estimatedTime:'8 hours',    lessons:40, progress:0, stages:[{id:'opening_principles',title:'Principles',description:'General guidelines',difficulty:1,completed:false},{id:'e4_openings',title:'1.e4 Openings',description:'Open games',difficulty:2,completed:false},{id:'d4_openings',title:'1.d4 Openings',description:'Closed games',difficulty:2,completed:false},{id:'italian_game',title:'Italian Game',description:'Classic 1.e4 e5',difficulty:2,completed:false},{id:'sicilian_defense',title:'Sicilian',description:'Fighting defense',difficulty:3,completed:false},{id:'queens_gambit',title:"Queen's Gambit",description:'Classic 1.d4',difficulty:2,completed:false},{id:'kings_indian',title:"King's Indian",description:'Dynamic counter',difficulty:3,completed:false},{id:'caro_kann',title:'Caro-Kann',description:'Solid defense',difficulty:2,completed:false}] },
  puzzles:  { id:'puzzles',  title:'Puzzle Training',  subtitle:'Sharpen your tactical vision',      icon:'🧩', color:'from-cyan-500 to-cyan-600',   difficulty:'all',          estimatedTime:'Unlimited', lessons:1000,progress:0, stages:[{id:'mate_in_1',title:'Mate in 1',description:'Quick checkmates',difficulty:1,completed:false},{id:'mate_in_2',title:'Mate in 2',description:'Two-move combos',difficulty:2,completed:false},{id:'mate_in_3',title:'Mate in 3',description:'Three-move tactics',difficulty:3,completed:false},{id:'tactics',title:'Tactics',description:'All tactical themes',difficulty:2,completed:false},{id:'endgames',title:'Endgame Puzzles',description:'Endgame technique',difficulty:3,completed:false},{id:'advanced',title:'Advanced',description:'Complex positions',difficulty:4,completed:false}] }
}

const ACHIEVEMENTS = {
  first_lesson:  { id:'first_lesson',  title:'First Steps',         description:'Complete your first lesson',      icon:'🎯', rarity:'common',    unlocked:false },
  basics_master: { id:'basics_master', title:'Basics Master',       description:'Complete all basics lessons',     icon:'🌟', rarity:'rare',      unlocked:false },
  tactics_expert:{ id:'tactics_expert',title:'Tactics Expert',      description:'Complete all tactics lessons',    icon:'⚔️', rarity:'rare',      unlocked:false },
  puzzle_master: { id:'puzzle_master', title:'Puzzle Master',       description:'Solve 100 puzzles',               icon:'🧩', rarity:'epic',      unlocked:false },
  endgame_king:  { id:'endgame_king',  title:'Endgame King',        description:'Complete all endgame lessons',    icon:'👑', rarity:'epic',      unlocked:false },
  opening_scholar:{id:'opening_scholar',title:'Opening Scholar',    description:'Complete all opening lessons',    icon:'📚', rarity:'epic',      unlocked:false },
  perfect_score: { id:'perfect_score', title:'Perfect Score',       description:'No mistakes in a lesson',         icon:'💯', rarity:'legendary', unlocked:false },
  speed_demon:   { id:'speed_demon',   title:'Speed Demon',         description:'5 lessons in one day',            icon:'⚡', rarity:'rare',      unlocked:false },
  consistency:   { id:'consistency',   title:'Consistent Learner',  description:'7 days in a row',                 icon:'🔥', rarity:'rare',      unlocked:false },
  grandmaster:   { id:'grandmaster',   title:'Grandmaster',         description:'Complete all lessons',            icon:'🏆', rarity:'legendary', unlocked:false }
}

const SKILL_RATINGS = {
  tactics:  { name:'Tactics',   rating:800, maxRating:2000, color:'text-red-400',     bar:'bg-red-500' },
  strategy: { name:'Strategy',  rating:750, maxRating:2000, color:'text-purple-400',  bar:'bg-purple-500' },
  endgames: { name:'Endgames',  rating:700, maxRating:2000, color:'text-amber-400',   bar:'bg-amber-500' },
  openings: { name:'Openings',  rating:720, maxRating:2000, color:'text-emerald-400', bar:'bg-emerald-500' }
}

const difficultyStyle = {
  beginner:     'bg-emerald-500/12 text-emerald-300 border-emerald-500/25',
  intermediate: 'bg-amber-500/12 text-amber-300 border-amber-500/25',
  advanced:     'bg-rose-500/12 text-rose-300 border-rose-500/25',
  all:          'bg-purple-500/12 text-purple-300 border-purple-500/25'
}

const rarityBorder = {
  common:    'border-slate-500/40',
  rare:      'border-blue-500/40',
  epic:      'border-purple-500/40',
  legendary: 'border-amber-500/40'
}

const catDisplayMap = {
  basics: {
    baseColor: 'blue',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
      </svg>
    )
  },
  tactics: {
    baseColor: 'red',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    )
  },
  strategy: {
    baseColor: 'purple',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.82 1.508-2.316a7.5 7.5 0 1 0-7.516 0c.85.496 1.508 1.333 1.508 2.316V18" />
      </svg>
    )
  },
  endgames: {
    baseColor: 'amber',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
      </svg>
    )
  },
  openings: {
    baseColor: 'emerald',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    )
  },
  puzzles: {
    baseColor: 'cyan',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
    )
  }
}

const colorMap = {
  emerald: { border: 'hover:border-emerald-500/40', text: 'group-hover:text-emerald-400', arrow: 'text-emerald-400' },
  blue: { border: 'hover:border-blue-500/40', text: 'group-hover:text-blue-400', arrow: 'text-blue-400' },
  purple: { border: 'hover:border-purple-500/40', text: 'group-hover:text-purple-400', arrow: 'text-purple-400' },
  amber: { border: 'hover:border-amber-500/40', text: 'group-hover:text-amber-400', arrow: 'text-amber-400' },
  red: { border: 'hover:border-red-500/40', text: 'group-hover:text-red-400', arrow: 'text-red-400' },
  cyan: { border: 'hover:border-cyan-500/40', text: 'group-hover:text-cyan-400', arrow: 'text-cyan-400' }
}

function LearnSection({ socket, onPuzzlesClick }) {
  const [activeMode, setActiveMode] = useState('categories')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [categories] = useState(LESSON_CATEGORIES)
  const [achievements] = useState(ACHIEVEMENTS)
  const [skillRatings] = useState(SKILL_RATINGS)
  const [showAchievements, setShowAchievements] = useState(false)

  const totalProgress = useMemo(() => {
    const total = Object.values(categories).reduce((a, c) => a + c.lessons, 0)
    const done = Object.values(categories).reduce((a, c) => a + c.stages.filter(s => s.completed).length, 0)
    return total > 0 ? Math.round((done / total) * 100) : 0
  }, [categories])

  const unlockedCount = useMemo(() => Object.values(achievements).filter(a => a.unlocked).length, [achievements])

  useEffect(() => {
    let active = true
    fetchProgressOverview().then(d => { if (active && d) {} }).catch(() => {})
    return () => { active = false }
  }, [])

  if (activeMode === 'lesson' && selectedLesson) {
    return <LearnLessonView lesson={selectedLesson} onBack={() => { setSelectedLesson(null); setActiveMode('lessons') }} />
  }

  const TABS = [
    { id: 'categories', label: 'Courses' },
    { id: 'practice',   label: 'Practice' },
    { id: 'puzzles',    label: 'Puzzles' }
  ]

  return (
    <div className='chess-page'>
      {/* Hero */}
      <div className='chess-hero relative overflow-hidden'>
        <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_5%_0%,rgba(34,211,238,0.14),transparent_55%)]' />
        <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_60%_at_95%_100%,rgba(99,102,241,0.1),transparent_60%)]' />
        <div className='relative p-6 md:p-8'>
          <div className='flex flex-wrap items-start justify-between gap-6'>
            <div>
              <p className='mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-400'>Learn Hub</p>
              <h1 className='font-serif text-3xl font-extrabold text-white md:text-4xl'>Master Chess</h1>
              <p className='mt-1.5 max-w-lg text-sm text-slate-400 leading-relaxed'>Comprehensive lessons from basics to grandmaster level. Track progress and earn achievements.</p>
            </div>
            <div className='flex gap-3'>
              <div className='card-compact !p-4 min-w-[100px] text-center border-cyan-500/20 bg-cyan-500/5'>
                <p className='text-[10px] font-bold uppercase tracking-widest text-cyan-400'>Progress</p>
                <p className='mt-1 font-serif text-2xl font-black text-white'>{totalProgress}%</p>
              </div>
              <div className='card-compact !p-4 min-w-[100px] text-center border-amber-500/20 bg-amber-500/5'>
                <p className='text-[10px] font-bold uppercase tracking-widest text-amber-400'>Badges</p>
                <p className='mt-1 font-serif text-2xl font-black text-white'>{unlockedCount}/10</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='space-y-6'>
        {/* Skill ratings */}
        <div className='chess-card'>
          <div className='mb-5 flex items-center justify-between'>
            <h3 className='font-serif text-lg font-bold text-white'>Skill Ratings</h3>
            <span className='badge-pill text-[10px] text-cyan-400 border-cyan-500/30 bg-cyan-500/10'>Current Level</span>
          </div>
          <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
            {Object.values(skillRatings).map(skill => (
              <div key={skill.name} className='card-compact !p-4'>
                <div className='mb-3 flex items-center justify-between'>
                  <span className={`text-sm font-bold ${skill.color}`}>{skill.name}</span>
                  <span className='font-serif text-lg font-bold text-white'>{skill.rating}</span>
                </div>
                <div className='h-1.5 overflow-hidden rounded-full bg-[#1e1e1e]'>
                  <div className={`h-full rounded-full ${skill.bar} transition-all duration-700 shadow-[0_0_10px_currentColor]`} style={{ width: `${(skill.rating / skill.maxRating) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className='flex flex-wrap items-center gap-3'>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveMode(tab.id)}
              className={`rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 ${activeMode === tab.id ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.15)]' : 'border-white/[0.08] bg-[rgba(255,255,255,0.02)] text-slate-400 hover:border-white/15 hover:text-white'}`}>
              {tab.label}
            </button>
          ))}
          <button onClick={() => setShowAchievements(!showAchievements)}
            className={`ml-auto rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 ${showAchievements ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-[0_0_15px_rgba(243,194,75,0.15)]' : 'border-white/[0.08] bg-[rgba(255,255,255,0.02)] text-slate-400 hover:border-white/15 hover:text-white'}`}>
            🏆 Achievements
          </button>
        </div>

        {/* Achievements */}
        {showAchievements && (
          <div className='chess-card border-amber-500/20'>
            <p className='mb-4 text-[11px] font-bold uppercase tracking-widest text-amber-500'>Unlocked Achievements</p>
            <div className='grid grid-cols-2 gap-3 md:grid-cols-5'>
              {Object.values(achievements).map(a => (
                <div key={a.id} className={`card-compact text-center !p-4 transition-all duration-300 ${a.unlocked ? 'border-amber-500/30 bg-amber-500/5 hover:-translate-y-1 hover:shadow-lg' : 'opacity-40 grayscale hover:grayscale-0'}`}>
                  <div className='mb-2 text-3xl'>{a.icon}</div>
                  <p className='text-xs font-bold text-white'>{a.title}</p>
                  <p className='mt-1 text-[10px] text-slate-400'>{a.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categories view */}
        {activeMode === 'categories' && !selectedCategory && (
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <h3 className='font-serif text-xl font-bold text-white'>Learning Paths</h3>
              <span className='badge-pill text-[10px] text-cyan-400'>{Object.keys(categories).length} Courses</span>
            </div>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
              {Object.values(categories).map(cat => {
                const display = catDisplayMap[cat.id]
                const cls = display ? colorMap[display.baseColor] : colorMap.cyan
                return (
                  <article key={cat.id} onClick={() => { setSelectedCategory(cat); setActiveMode('lessons') }}
                    className={`group flex h-full cursor-pointer flex-col items-start rounded-2xl border border-white/[0.04] bg-[#1e1e1e] p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:bg-[#252526] hover:shadow-2xl ${cls.border}`}>
                    <div className='mb-2 flex w-full items-start justify-between'>
                      <div className="transition-transform duration-300 group-hover:scale-110">
                        {display?.icon || cat.icon}
                      </div>
                      <span className={`badge-pill text-[9px] uppercase tracking-wider ${difficultyStyle[cat.difficulty] || difficultyStyle.intermediate}`}>{cat.difficulty}</span>
                    </div>
                    <div className='flex-1 w-full'>
                      <h4 className={`mb-1.5 font-serif text-xl font-bold text-white transition-colors ${cls.text}`}>{cat.title}</h4>
                      <p className='mb-6 line-clamp-2 text-[13px] text-slate-400 leading-relaxed'>{cat.subtitle}</p>
                    </div>
                    <div className='w-full space-y-3 mt-auto'>
                      <div className='flex items-center justify-between text-[11px] font-semibold text-slate-500'>
                        <span>{cat.lessons} lessons</span>
                        <span>{cat.estimatedTime}</span>
                      </div>
                      <div className='h-1.5 w-full overflow-hidden rounded-full bg-[#1e1e1e]'>
                        <div className={`h-full rounded-full bg-gradient-to-r ${cat.color} shadow-[0_0_8px_currentColor]`} style={{ width: `${cat.progress}%` }} />
                      </div>
                      <div className='flex items-center justify-between pt-1'>
                        <span className='text-[11px] font-bold text-slate-500'>{cat.progress}% complete</span>
                        <span className={`text-sm font-bold flex items-center gap-1.5 transition-transform group-hover:translate-x-1 ${cls.arrow}`}>Start learning <span className="text-lg leading-none">›</span></span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )}

        {/* Lessons list */}
        {activeMode === 'lessons' && selectedCategory && (
          <div className='space-y-6'>
            <button onClick={() => { setSelectedCategory(null); setActiveMode('categories') }}
              className='chess-btn-secondary flex items-center gap-2'>
              <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4' viewBox='0 0 20 20' fill='currentColor'><path fillRule='evenodd' d='M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z' clipRule='evenodd' /></svg>
              Back to Courses
            </button>
            <div className={`hero-accent overflow-hidden p-6 md:p-8 bg-gradient-to-br ${selectedCategory.color} border-none shadow-[0_20px_50px_rgba(2,6,23,0.5)]`}>
              <div className='relative z-10 flex flex-col md:flex-row items-center gap-6'>
                <div className='flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-4xl shadow-inner backdrop-blur-sm'>{selectedCategory.icon}</div>
                <div className='flex-1 text-center md:text-left'>
                  <h2 className='font-serif text-2xl font-bold text-white md:text-3xl'>{selectedCategory.title}</h2>
                  <p className='mt-2 text-sm text-white/80 font-medium'>{selectedCategory.subtitle}</p>
                </div>
                <div className='text-center md:text-right bg-black/20 rounded-xl p-4 backdrop-blur-md border border-white/10'>
                  <p className='font-serif text-4xl font-black text-white'>{selectedCategory.progress}%</p>
                  <p className='mt-1 text-[11px] font-bold uppercase tracking-wider text-white/70'>{selectedCategory.stages.filter(s => s.completed).length}/{selectedCategory.stages.length} Completed</p>
                </div>
              </div>
            </div>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
              {selectedCategory.stages.map((stage, idx) => (
                <div key={stage.id} onClick={() => { setSelectedLesson(stage); setActiveMode('lesson') }}
                  className={`group flex cursor-pointer flex-col rounded-2xl border border-white/[0.04] bg-[#1e1e1e] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/10 hover:bg-[#252526] hover:shadow-xl ${stage.completed ? '!border-emerald-500/30 !bg-emerald-500/5 hover:!bg-emerald-500/10' : ''}`}>
                  <div className='mb-3 flex items-start justify-between'>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shadow-inner transition-transform duration-300 group-hover:scale-110 ${stage.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/15 text-cyan-400'}`}>
                      {stage.completed ? '✓' : idx + 1}
                    </div>
                    <span className='badge-pill text-[9px] text-slate-500'>Lvl {stage.difficulty}</span>
                  </div>
                  <div className='flex-1'>
                    <p className='mb-1 text-base font-bold text-white group-hover:text-cyan-400 transition-colors'>{stage.title}</p>
                    <p className='text-[12px] text-slate-400'>{stage.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeMode === 'practice' && <GameAnalysis socket={socket} hideLiveOptions />}

        {activeMode === 'puzzles' && (
          <div className='chess-card text-center p-12 max-w-2xl mx-auto'>
            <div className='text-6xl mb-6'>🧩</div>
            <h3 className='font-serif text-3xl font-bold text-white mb-3'>Puzzle Training</h3>
            <p className='text-slate-400 mb-8 leading-relaxed'>Sharpen your tactical vision with thousands of curated puzzles. Track your puzzle rating and climb the leaderboards.</p>
            <button onClick={() => typeof onPuzzlesClick === 'function' && onPuzzlesClick()}
              className='chess-btn-primary px-8 py-3 text-lg'>
              Start Puzzle Rush ⚡
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default LearnSection
