import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

const PROFILE_RATING_FALLBACK = {
  bullet: '-',
  blitz: '-',
  rapid: '-'
}

function Navbar({ onMenuClick, status, onLogout, onProfileClick }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileUsername, setProfileUsername] = useState('')
  const [profileStatus, setProfileStatus] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [memberProfile, setMemberProfile] = useState(null)
  const [memberProfileLoading, setMemberProfileLoading] = useState(false)
  const [memberProfileError, setMemberProfileError] = useState('')
  const user = useAuthStore((state) => state.user)
  const updateUsername = useAuthStore((state) => state.updateUsername)
  const displayName = user?.displayName || user?.username || 'Player'
  const email = user?.email || 'No email'
  const profileRatings = memberProfile?.ratings || PROFILE_RATING_FALLBACK

  useEffect(() => {
    if (!profileOpen) return
    setProfileUsername(String(user?.username || user?.displayName || '').trim())
    setProfileStatus('')
    setMemberProfileError('')
    setMemberProfile(null)
    setMemberProfileLoading(false)
  }, [profileOpen, user?.username, user?.displayName])

  useEffect(() => {
    let active = true

    const loadMemberProfile = async () => {
      if (!profileOpen) return
      const slug = String(user?.username || user?.displayName || '').trim()
      if (!slug) return

      setMemberProfileLoading(true)
      setMemberProfileError('')

      try {
        const response = await fetch(`/api/ratings/player/${encodeURIComponent(slug)}`)
        const payload = await response.json()
        if (!response.ok || !payload?.success || !payload?.data) {
          throw new Error(payload?.error || 'Unable to load profile ratings')
        }
        const data = payload.data
        if (!active) return
        setMemberProfile(data)
      } catch (error) {
        if (!active) return
        setMemberProfile(null)
        setMemberProfileError(error?.message || 'Unable to load profile ratings')
      } finally {
        if (active) setMemberProfileLoading(false)
      }
    }

    void loadMemberProfile()

    return () => {
      active = false
    }
  }, [profileOpen, user?.username, user?.displayName])

  const handleSaveProfileUsername = async () => {
    if (savingProfile) return
    setProfileStatus('')
    setSavingProfile(true)
    try {
      const requestedUsername = String(profileUsername || '').trim()
      if (!requestedUsername) {
        throw new Error('Username is required')
      }
      if (requestedUsername === String(user?.username || '').trim()) {
        setProfileStatus('Username already saved.')
        return
      }
      await updateUsername(requestedUsername)
      setProfileStatus('Username updated successfully.')
    } catch (error) {
      setProfileStatus(error?.message || 'Failed to update username')
    } finally {
      setSavingProfile(false)
    }
  }

  const useCurrentUsername = () => {
    setProfileUsername(String(user?.username || user?.displayName || '').trim())
  }

  return (
    <header className='sticky top-0 z-10 bg-[rgba(10,11,12,0.45)] backdrop-blur-md'>
      <div className='mx-auto flex h-16 items-center gap-3 px-4 md:px-6 max-w-6xl'>
        <button
          onClick={onMenuClick}
          className='rounded-lg p-2 text-slate-300 hover:bg-white/5 md:hidden'
          aria-label='Open menu'
        >
          <svg className='h-5 w-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <path d='M3 6h18M3 12h18M3 18h18' />
          </svg>
        </button>

        <div className='hidden items-center gap-2 md:flex'>
          <span className='text-lg font-semibold text-white'>Chess Pro</span>
          <span className='ml-2 inline-block rounded-md px-2 py-0.5 text-xs font-medium text-[rgba(11,11,11,0.9)]' style={{background: 'linear-gradient(90deg,#ffd970,#f3c24b)'}}>Premium</span>
        </div>

        <div className='relative ml-auto max-w-md flex-1'>
          <input
            type='text'
            placeholder='Search players, openings, tournaments...'
            className='h-11 w-full rounded-xl border border-white/6 bg-[rgba(255,255,255,0.02)] pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none shadow-sm'
          />
          <svg className='pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-slate-500' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'>
            <circle cx='11' cy='11' r='7' />
            <path d='m20 20-3.5-3.5' />
          </svg>
        </div>

        <button className='relative rounded-lg p-2 text-slate-300 hover:bg-white/5'>
          <span className='absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#4caf50]' />
          <svg className='h-5 w-5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'>
            <path d='M15 17H5l2-2v-4a5 5 0 0 1 10 0v4l2 2h-4' />
            <path d='M9.5 20a2.5 2.5 0 0 0 5 0' />
          </svg>
        </button>

        <div className='relative'>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className='flex items-center gap-2 chess-btn-secondary px-3 py-1.5'
          >
            <div className='h-7 w-7 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-500' />
            <span className='hidden md:inline'>{displayName}</span>
          </button>
          {profileOpen && (
            <div className='absolute right-0 mt-2 w-[26rem] overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#17181d] text-sm text-slate-200 shadow-2xl elevated'>
              <div className='relative border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] px-5 py-5'>
                <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_0%,rgba(255,217,112,0.08),transparent_55%)]' />
                <div className='relative flex items-start justify-between gap-3'>
                  <div className='flex items-center gap-3'>
                    <div className='h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400 via-emerald-400 to-amber-300 p-[2px]'>
                      <div className='flex h-full w-full items-center justify-center rounded-[14px] bg-[#101216] text-lg font-black text-white'>
                        {String(displayName || 'P').trim().slice(0, 1).toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <p className='truncate text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300'>My Profile</p>
                      <p className='mt-1 truncate text-lg font-black text-white'>{displayName}</p>
                      <p className='mt-1 truncate text-[11px] text-slate-400'>{email}</p>
                    </div>
                  </div>
                  <button
                    type='button'
                    onClick={() => setProfileOpen(false)}
                    className='rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10'
                  >
                    Close
                  </button>
                </div>

                <div className='mt-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400'>
                  <span className='rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-300'>Online</span>
                  <span className='rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-amber-300'>Crystal League</span>
                  <span className='rounded-full border border-white/10 bg-white/5 px-2 py-1'>11 Day Streak</span>
                </div>

                <div className='mt-4 grid grid-cols-3 gap-2'>
                  {[
                    { label: 'Bullet', value: profileRatings.bullet },
                    { label: 'Blitz', value: profileRatings.blitz },
                    { label: 'Rapid', value: profileRatings.rapid }
                  ].map((item) => (
                    <div key={item.label} className='rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center shadow-[0_0_12px_rgba(0,0,0,0.25)]'>
                      <p className='text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500'>{item.label}</p>
                      <p className='mt-1 text-lg font-black text-white'>{item.value ?? '-'}</p>
                    </div>
                  ))}
                </div>

                <div className='mt-4 grid grid-cols-3 gap-2'>
                  {[
                    { label: 'Joined', value: memberProfile?.joinedAt || '-' },
                    { label: 'Friends', value: memberProfile?.friendsCount ?? '-' },
                    { label: 'Views', value: memberProfile?.views ?? '-' }
                  ].map((item) => (
                    <div key={item.label} className='rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center'>
                      <p className='text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500'>{item.label}</p>
                      <p className='mt-1 text-sm font-bold text-slate-100'>{item.value ?? '-'}</p>
                    </div>
                  ))}
                </div>

                <div className='mt-4 flex flex-wrap gap-2'>
                  {['Overview', 'Games', 'Stats', 'Awards', 'Clubs'].map((tab) => (
                    <span key={tab} className='rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300'>
                      {tab}
                    </span>
                  ))}
                </div>

                {memberProfileLoading ? (
                  <p className='mt-3 text-[11px] text-cyan-200'>Loading ratings...</p>
                ) : memberProfileError ? (
                  <p className='mt-3 text-[11px] text-amber-200'>{memberProfileError}</p>
                ) : null}
              </div>

              <div className='space-y-3 p-4'>
                <div className='rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5'>
                  <p className='text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500'>Profile Username</p>
                  <input
                    type='text'
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    placeholder='Enter username'
                    className='mt-2 h-10 w-full rounded-xl border border-white/10 bg-[#111317] px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none'
                  />
                  <div className='mt-3 flex items-center gap-2'>
                    <button
                      type='button'
                      onClick={handleSaveProfileUsername}
                      disabled={savingProfile}
                      className='chess-btn-primary'
                    >
                      {savingProfile ? 'Saving...' : 'Save Username'}
                    </button>
                    <button
                      type='button'
                      onClick={useCurrentUsername}
                      className='rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold text-slate-200 transition hover:bg-white/5'
                    >
                      Use Current
                    </button>
                  </div>
                  {profileStatus ? (
                    <p className={`mt-2 text-[11px] ${profileStatus.toLowerCase().includes('success') ? 'text-emerald-300' : 'text-red-300'}`}>
                      {profileStatus}
                    </p>
                  ) : null}
                </div>

                <div className='grid grid-cols-2 gap-2'>
                  <button
                    onClick={() => {
                      if (typeof onProfileClick === 'function') onProfileClick()
                      setProfileOpen(false)
                    }}
                    className='rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-slate-100 transition hover:bg-white/10'
                  >
                    View Profile
                  </button>
                  <button onClick={onLogout} className='rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-left text-red-300 transition hover:bg-red-500/15'>
                    Logout
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar
