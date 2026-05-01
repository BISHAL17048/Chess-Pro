import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

function Navbar({ onMenuClick, status, onLogout }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileUsername, setProfileUsername] = useState('')
  const [profileStatus, setProfileStatus] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const user = useAuthStore((state) => state.user)
  const updateUsername = useAuthStore((state) => state.updateUsername)
  const displayName = user?.displayName || user?.username || 'Player'
  const email = user?.email || 'No email'

  useEffect(() => {
    if (!profileOpen) return
    setProfileUsername(String(user?.username || user?.displayName || '').trim())
    setProfileStatus('')
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
    <header className='sticky top-0 z-10 border-b border-white/10 bg-[#1f1f1f]/80 backdrop-blur-xl'>
      <div className='mx-auto flex h-16 items-center gap-3 px-4 md:px-6'>
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
          <span className='text-lg font-semibold text-white'>Chess</span>
        </div>

        <div className='relative ml-auto max-w-md flex-1'>
          <input
            type='text'
            placeholder='Search players, openings, tournaments...'
            className='h-10 w-full rounded-xl border border-white/10 bg-slate-900/80 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none'
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
            className='flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-2 py-1.5 text-sm text-slate-200 hover:border-white/20'
          >
            <div className='h-7 w-7 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-500' />
            <span className='hidden md:inline'>{displayName}</span>
          </button>
          {profileOpen && (
            <div className='absolute right-0 mt-2 w-72 rounded-xl border border-white/10 bg-[#2d2d30] p-2 text-sm text-slate-200 shadow-xl'>
              <div className='mb-1 rounded-lg border border-white/10 bg-[#252526] px-3 py-2'>
                <p className='truncate text-xs font-semibold text-white'>{displayName}</p>
                <p className='truncate text-[11px] text-slate-400'>{email}</p>
              </div>
              <div className='mb-2 rounded-lg border border-white/10 bg-[#252526] px-3 py-2'>
                <p className='mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400'>Profile Username</p>
                <input
                  type='text'
                  value={profileUsername}
                  onChange={(e) => setProfileUsername(e.target.value)}
                  placeholder='Enter username'
                  className='mb-2 h-9 w-full rounded-lg border border-white/15 bg-[#1e1e1e] px-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none'
                />
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={handleSaveProfileUsername}
                    disabled={savingProfile}
                    className='rounded-lg border border-cyan-300/35 px-2 py-1 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60'
                  >
                    {savingProfile ? 'Saving...' : 'Save Username'}
                  </button>
                  <button
                    type='button'
                    onClick={useCurrentUsername}
                    className='rounded-lg border border-white/15 px-2 py-1 text-[11px] text-slate-200 transition hover:bg-white/5'
                  >
                      Use Current Username
                  </button>
                </div>
                {profileStatus ? (
                  <p className={`mt-2 text-[11px] ${profileStatus.toLowerCase().includes('success') ? 'text-emerald-300' : 'text-red-300'}`}>
                    {profileStatus}
                  </p>
                ) : null}
              </div>
              <button onClick={onLogout} className='w-full rounded-lg px-3 py-2 text-left text-red-300 hover:bg-red-500/10'>Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar
