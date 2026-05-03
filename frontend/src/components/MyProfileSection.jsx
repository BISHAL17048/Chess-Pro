import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { BOARD_THEMES, useBoardThemeStore } from '../store/useBoardThemeStore'

const PROFILE_TABS = ['Overview', 'Games', 'Stats', 'Awards', 'Clubs']
const STATS_MODES = ['rapid', 'blitz', 'bullet']

function MyProfileSection() {
  const user = useAuthStore((state) => state.user)
  const themeId = useBoardThemeStore((state) => state.themeId)
  const setThemeId = useBoardThemeStore((state) => state.setThemeId)
  const [activeTab, setActiveTab] = useState('Overview')
  const [activeMode, setActiveMode] = useState('rapid')
  const [statsMode, setStatsMode] = useState('rapid')
  const [memberProfile, setMemberProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const gamesRef = useRef(null)
  const modeRefs = useRef({ rapid: null, blitz: null, bullet: null })

  const displayName = user?.displayName || user?.username || 'Player'
  const email = user?.email || 'No email'
  const initials = String(displayName || 'P')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'P'

  useEffect(() => {
    let active = true

    const loadProfile = async () => {
      const slug = String(user?.username || user?.displayName || '').trim()
      if (!slug) return

      setProfileLoading(true)
      setProfileError('')

      try {
        const response = await fetch(`/api/ratings/player/${encodeURIComponent(slug)}`)
        const payload = await response.json()
        if (!response.ok || !payload?.success || !payload?.data) {
          throw new Error(payload?.error || 'Unable to load profile data')
        }
        if (!active) return
        setMemberProfile(payload.data)
      } catch (error) {
        if (!active) return
        setMemberProfile(null)
        setProfileError(error?.message || 'Unable to load profile data')
      } finally {
        if (active) setProfileLoading(false)
      }
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [user?.username, user?.displayName])

  const ratingCards = useMemo(() => (
    [
      { label: 'Bullet', value: memberProfile?.ratings?.bullet ?? '-' },
      { label: 'Blitz', value: memberProfile?.ratings?.blitz ?? '-' },
      { label: 'Rapid', value: memberProfile?.ratings?.rapid ?? '-' }
    ]
  ), [memberProfile])

  const statCards = [
    { label: 'Joined', value: memberProfile?.joinedAt || '-' },
    { label: 'Friends', value: memberProfile?.friendsCount ?? '-' },
    { label: 'Views', value: memberProfile?.views ?? '-' },
    { label: 'League', value: memberProfile?.league || 'Crystal' }
  ]

  const dailyGameLog = useMemo(() => (
    [
      { id: 'g1', date: '2026-05-03', mode: 'rapid', opponent: 'BReaking_BAdaas', result: 'Loss', moves: 0 },
      { id: 'g2', date: '2026-05-03', mode: 'bullet', opponent: 'mdfardinhasan', result: 'Win', moves: 37 },
      { id: 'g3', date: '2026-05-02', mode: 'blitz', opponent: 'wolfofstreett', result: 'Win', moves: 59 },
      { id: 'g4', date: '2026-05-02', mode: 'rapid', opponent: 'jogui44', result: 'Loss', moves: 31 },
      { id: 'g5', date: '2026-05-01', mode: 'rapid', opponent: 'LCEDENO', result: 'Win', moves: 23 },
      { id: 'g6', date: '2026-05-01', mode: 'blitz', opponent: 'tigone974', result: 'Loss', moves: 32 },
      { id: 'g7', date: '2026-04-30', mode: 'bullet', opponent: 'magnetcoleslaw', result: 'Win', moves: 35 },
      { id: 'g8', date: '2026-04-30', mode: 'rapid', opponent: 'Iwona789', result: 'Loss', moves: 56 },
      { id: 'g9', date: '2026-04-29', mode: 'blitz', opponent: 'cemilesusuz', result: 'Loss', moves: 1 }
    ]
  ), [])

  const modeGraphs = useMemo(() => (
    {
      rapid: [510, 506, 501, 496, 492, 488, 485, 482, 480, 478, 479, 481, 483, 485, 486, 484, 482, 481, 482, 483],
      bullet: [732, 734, 736, 739, 742, 744, 747, 745, 748, 751, 753, 750, 752, 754, 753, 755, 754, 753, 752, 752],
      blitz: [575, 572, 570, 568, 566, 565, 563, 562, 561, 560, 559, 559, 558, 558, 558, 557, 557, 557, 557, 557]
    }
  ), [])

  const statsByMode = useMemo(() => (
    {
      rapid: {
        rating: memberProfile?.ratings?.rapid ?? 1200,
        best: 1284,
        bestDate: '2026-04-18',
        games: 482,
        wins: 251,
        losses: 198,
        draws: 33,
        winRate: 52,
        streak: 4,
        avgOpponent: 1210,
        series: modeGraphs.rapid
      },
      blitz: {
        rating: memberProfile?.ratings?.blitz ?? 1171,
        best: 1259,
        bestDate: '2026-03-26',
        games: 214,
        wins: 103,
        losses: 97,
        draws: 14,
        winRate: 48,
        streak: 2,
        avgOpponent: 1163,
        series: modeGraphs.blitz
      },
      bullet: {
        rating: memberProfile?.ratings?.bullet ?? 1219,
        best: 1310,
        bestDate: '2026-04-09',
        games: 165,
        wins: 92,
        losses: 66,
        draws: 7,
        winRate: 55,
        streak: 6,
        avgOpponent: 1204,
        series: modeGraphs.bullet
      }
    }
  ), [memberProfile, modeGraphs])

  const dailyTotals = useMemo(() => {
    const byDate = {}
    dailyGameLog.forEach((game) => {
      if (!byDate[game.date]) {
        byDate[game.date] = { date: game.date, rapid: 0, blitz: 0, bullet: 0 }
      }
      byDate[game.date][game.mode] += 1
    })
    return Object.values(byDate)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 7)
  }, [dailyGameLog])

  const openModeGames = (mode) => {
    setActiveTab('Overview')
    setActiveMode(mode)
    requestAnimationFrame(() => {
      if (modeRefs.current[mode]) {
        modeRefs.current[mode].scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (gamesRef.current) {
        gamesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }

  const renderSparkline = (values, color, fill) => {
    const max = Math.max(...values)
    const min = Math.min(...values)
    const span = Math.max(1, max - min)
    const range = max - min
    const pad = Math.max(4, Math.min(18, range * 0.18))
    const top = max + pad
    const bottom = min - pad
    const scale = Math.max(1, top - bottom)
    const points = values
      .map((val, idx) => {
        const x = (idx / (values.length - 1)) * 100
        const y = 100 - ((val - bottom) / scale) * 100
        return `${x},${y}`
      })
      .join(' ')

    const area = `${points} 100,100 0,100`
    const lastIdx = values.length - 1
    const lastX = (lastIdx / (values.length - 1)) * 100
    const lastY = 100 - ((values[lastIdx] - bottom) / scale) * 100

    return (
      <svg viewBox='0 0 100 100' className='h-16 w-full'>
        <defs>
          <linearGradient id={`area-${color}`} x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor={fill} stopOpacity='0.6' />
            <stop offset='100%' stopColor={fill} stopOpacity='0' />
          </linearGradient>
        </defs>
        <path d={`M${area}`} fill={`url(#area-${color})`} />
        <polyline
          points={points}
          fill='none'
          stroke={color}
          strokeWidth='3.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <circle cx={lastX} cy={lastY} r='2.6' fill={color} />
        <line x1='0' y1='92' x2='100' y2='92' stroke='rgba(255,255,255,0.08)' strokeWidth='2' />
      </svg>
    )
  }

  return (
    <div className='chess-page space-y-6'>
      <div className='chess-hero relative overflow-hidden'>
        <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_90%_at_0%_0%,rgba(243,194,75,0.12),transparent_55%)]' />
        <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_70%_at_100%_100%,rgba(34,197,94,0.1),transparent_60%)]' />
        <div className='relative p-6 md:p-8'>
          <p className='text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-300'>My Profile</p>
          <div className='mt-4 flex flex-col gap-6 md:flex-row md:items-center md:justify-between'>
            <div className='flex items-center gap-4'>
              <div className='h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-300 via-cyan-300 to-emerald-300 p-[2px]'>
                <div className='flex h-full w-full items-center justify-center rounded-[18px] bg-[#101216] text-2xl font-black text-white'>
                  {initials}
                </div>
              </div>
              <div>
                <h1 className='font-serif text-3xl font-extrabold text-white md:text-4xl'>{displayName}</h1>
                <p className='mt-1 text-sm text-slate-400'>{email}</p>
                <div className='mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]'>
                  <span className='rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-300'>Online</span>
                  <span className='rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-300'>11 Day Streak</span>
                  <span className='rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300'>Crystal League</span>
                </div>
              </div>
            </div>
            <div className='grid grid-cols-3 gap-2 md:min-w-[320px]'>
              {ratingCards.map((card) => (
                <div key={card.label} className='rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center shadow-[0_0_14px_rgba(0,0,0,0.3)]'>
                  <p className='text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500'>{card.label}</p>
                  <p className='mt-1 text-lg font-black text-white'>{card.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
        {statCards.map((card) => (
          <div key={card.label} className='card-compact px-4 py-3 text-center'>
            <p className='text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500'>{card.label}</p>
            <p className='mt-1 text-lg font-black text-white'>{card.value}</p>
          </div>
        ))}
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        {PROFILE_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
              activeTab === tab
                ? 'border-amber-400/50 bg-amber-400/10 text-amber-200 shadow-[0_0_12px_rgba(243,194,75,0.2)]'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
        <div className='chess-card lg:col-span-2'>
          <p className='mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400'>{activeTab}</p>
          {profileLoading && <p className='text-sm text-amber-200'>Loading profile data...</p>}
          {!profileLoading && profileError && (
            <p className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300'>{profileError}</p>
          )}
          {!profileLoading && !profileError && activeTab === 'Overview' && (
            <div className='space-y-6 text-sm text-slate-300'>
              <p>Daily performance snapshot and game tracking by time control.</p>

              <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
                <button
                  onClick={() => openModeGames('rapid')}
                  className={`group rounded-2xl border px-4 py-3 text-left transition ${activeMode === 'rapid' ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                >
                  <div className='flex items-start justify-between'>
                    <div>
                      <p className='text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400'>Rapid</p>
                      <p className='mt-1 text-2xl font-black text-white'>{memberProfile?.ratings?.rapid ?? 483}</p>
                    </div>
                    <span className='text-xs font-bold text-emerald-300'>+18</span>
                  </div>
                  <div className='mt-2 text-emerald-300'>{renderSparkline(modeGraphs.rapid, '#34d399', '#0f3d2e')}</div>
                </button>

                <button
                  onClick={() => openModeGames('bullet')}
                  className={`group rounded-2xl border px-4 py-3 text-left transition ${activeMode === 'bullet' ? 'border-amber-400/40 bg-amber-400/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                >
                  <div className='flex items-start justify-between'>
                    <div>
                      <p className='text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400'>Bullet</p>
                      <p className='mt-1 text-2xl font-black text-white'>{memberProfile?.ratings?.bullet ?? 752}</p>
                    </div>
                    <span className='text-xs font-bold text-emerald-300'>+8</span>
                  </div>
                  <div className='mt-2 text-amber-300'>{renderSparkline(modeGraphs.bullet, '#f59e0b', '#3c2a05')}</div>
                </button>

                <button
                  onClick={() => openModeGames('blitz')}
                  className={`group rounded-2xl border px-4 py-3 text-left transition ${activeMode === 'blitz' ? 'border-cyan-400/40 bg-cyan-400/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                >
                  <div className='flex items-start justify-between'>
                    <div>
                      <p className='text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400'>Blitz</p>
                      <p className='mt-1 text-2xl font-black text-white'>{memberProfile?.ratings?.blitz ?? 557}</p>
                    </div>
                    <span className='text-xs font-bold text-red-300'>-27</span>
                  </div>
                  <div className='mt-2 text-cyan-300'>{renderSparkline(modeGraphs.blitz, '#22d3ee', '#0b3642')}</div>
                </button>
              </div>

              <div className='rounded-2xl border border-white/10 bg-white/5 px-4 py-4'>
                <p className='text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400'>Daily Games Played</p>
                <div className='mt-3 space-y-2'>
                  {dailyTotals.map((day) => (
                    <div key={day.date} className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2'>
                      <p className='text-xs font-semibold text-slate-300'>{day.date}</p>
                      <div className='flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]'>
                        <span className='rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-emerald-300'>Rapid {day.rapid}</span>
                        <span className='rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-amber-300'>Bullet {day.bullet}</span>
                        <span className='rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-cyan-200'>Blitz {day.blitz}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div ref={gamesRef} />
            </div>
          )}

          {!profileLoading && !profileError && activeTab === 'Stats' && (
            <div className='space-y-6 text-sm text-slate-300'>
              <div className='flex flex-wrap items-center gap-2'>
                {STATS_MODES.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setStatsMode(mode)}
                    className={`rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                      statsMode === mode
                        ? 'border-amber-400/50 bg-amber-400/10 text-amber-200'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className='rounded-2xl border border-white/10 bg-white/5 p-4'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <div>
                    <p className='text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400'>{statsMode} rating</p>
                    <p className='mt-1 text-3xl font-black text-white'>{statsByMode[statsMode].rating}</p>
                    <p className='mt-1 text-[11px] text-slate-400'>Best {statsByMode[statsMode].best} · {statsByMode[statsMode].bestDate}</p>
                  </div>
                  <div className='min-w-[220px] flex-1 text-right'>
                    {renderSparkline(statsByMode[statsMode].series, statsMode === 'rapid' ? '#34d399' : statsMode === 'bullet' ? '#f59e0b' : '#22d3ee', statsMode === 'rapid' ? '#0f3d2e' : statsMode === 'bullet' ? '#3c2a05' : '#0b3642')}
                  </div>
                </div>
              </div>

              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                {[
                  { label: 'Games', value: statsByMode[statsMode].games },
                  { label: 'Win Rate', value: `${statsByMode[statsMode].winRate}%` },
                  { label: 'Streak', value: `${statsByMode[statsMode].streak} wins` },
                  { label: 'Avg Opp', value: statsByMode[statsMode].avgOpponent }
                ].map((card) => (
                  <div key={card.label} className='rounded-xl border border-white/10 bg-black/20 px-4 py-3'>
                    <p className='text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500'>{card.label}</p>
                    <p className='mt-1 text-lg font-black text-white'>{card.value}</p>
                  </div>
                ))}
              </div>

              <div className='rounded-2xl border border-white/10 bg-white/5 px-4 py-4'>
                <p className='text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400'>Results breakdown</p>
                <div className='mt-3 grid grid-cols-3 gap-3'>
                  {[
                    { label: 'Wins', value: statsByMode[statsMode].wins, cls: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' },
                    { label: 'Losses', value: statsByMode[statsMode].losses, cls: 'border-rose-400/20 bg-rose-400/10 text-rose-200' },
                    { label: 'Draws', value: statsByMode[statsMode].draws, cls: 'border-amber-400/20 bg-amber-400/10 text-amber-200' }
                  ].map((item) => (
                    <div key={item.label} className={`rounded-xl border px-3 py-2 text-center ${item.cls}`}>
                      <p className='text-[10px] font-semibold uppercase tracking-[0.18em]'>{item.label}</p>
                      <p className='mt-1 text-lg font-black text-white'>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className='chess-card'>
          <p className='mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400'>Profile Actions</p>
          <div className='space-y-2'>
            <button className='chess-btn-secondary w-full'>Share Profile</button>
            <button className='chess-btn-secondary w-full'>Customize Flair</button>
            <button className='chess-btn-secondary w-full'>View Game History</button>
          </div>
        </div>

        <div className='chess-card'>
          <p className='mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400'>Board Theme</p>
          <div className='grid grid-cols-2 gap-3'>
            {BOARD_THEMES.map((theme) => {
              const selected = theme.id === themeId
              return (
                <button
                  key={theme.id}
                  onClick={() => setThemeId(theme.id)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    selected
                      ? 'border-cyan-300/70 bg-cyan-400/10 text-cyan-200'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                  }`}
                >
                  <div className='mb-2 flex h-6 overflow-hidden rounded-lg border border-black/20'>
                    <span className='block h-full flex-1' style={{ backgroundColor: theme.light }} />
                    <span className='block h-full flex-1' style={{ backgroundColor: theme.dark }} />
                  </div>
                  {theme.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MyProfileSection
