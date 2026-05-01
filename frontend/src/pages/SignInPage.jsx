import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

function SignInPage({ onSwitchToSignup }) {
  const { login, loginWithGoogle, loading, error, clearError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    await login({ email, password })
  }

  const submitGoogle = async () => {
    await loginWithGoogle()
  }

  const GoogleIcon = () => (
    <svg aria-hidden='true' viewBox='0 0 48 48' className='h-5 w-5'>
      <path fill='#FFC107' d='M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z' />
      <path fill='#FF3D00' d='M6.3 14.7l6.6 4.8C14.7 15 19 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z' />
      <path fill='#4CAF50' d='M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.3 35 26.8 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.6 5.1C9.6 39.7 16.3 44 24 44z' />
      <path fill='#1976D2' d='M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.3 4.4-4.1 5.8l.1-.1 6.2 5.2C37 39.3 44 34 44 24c0-1.2-.1-2.4-.4-3.5z' />
    </svg>
  )

  return (
    <div className='relative min-h-screen overflow-hidden bg-[#1e1e1e] text-slate-100'>
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(58,58,60,.3),transparent_48%)]' />

      <div className='relative mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-8 px-4 py-8 md:px-8 lg:grid-cols-[1.05fr_1fr]'>
        <section className='hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#252526] via-[#2d2d30] to-[#1f1f1f] p-10 shadow-2xl shadow-black/30 lg:block'>
          <div className='mb-6 flex flex-col items-center'>
            <img src='/logo.svg' alt='Chess Pro' className='h-48 w-auto mb-4' />
            <h1 className='text-3xl font-black tracking-wider text-white'>
              CHESS<span className='text-[#D4AF37] ml-2'>PRO</span>
            </h1>
          </div>
          <h1 className='text-4xl font-bold leading-tight text-white'>
            Play smarter.
            <br />
            Climb faster.
          </h1>
          <p className='mt-4 max-w-md text-slate-300'>
            Enter your account to join live matches, track rating progress, and improve with every game.
          </p>

          <div className='mt-8 grid grid-cols-3 gap-3 text-center'>
            <div className='rounded-xl border border-white/10 bg-black/20 p-3'>
              <p className='text-2xl font-bold text-amber-300'>24/7</p>
              <p className='text-xs text-slate-300'>Live Rooms</p>
            </div>
            <div className='rounded-xl border border-white/10 bg-black/20 p-3'>
              <p className='text-2xl font-bold text-emerald-300'>1v1</p>
              <p className='text-xs text-slate-300'>Quick Match</p>
            </div>
            <div className='rounded-xl border border-white/10 bg-black/20 p-3'>
              <p className='text-2xl font-bold text-cyan-300'>PGN</p>
              <p className='text-xs text-slate-300'>Game Review</p>
            </div>
          </div>
        </section>

        <section className='mx-auto w-full max-w-md rounded-3xl border border-white/15 bg-[#2d2d30]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur md:p-8'>
          <h2 className='text-3xl font-bold text-white'>Sign In</h2>
          <p className='mt-1 text-sm text-slate-300'>Welcome back. Continue with email or Google.</p>

          <form className='mt-6 space-y-4' onSubmit={submit}>
            <label className='block text-sm text-slate-300'>
              Email
              <input
                type='email'
                value={email}
                onChange={(e) => {
                  clearError()
                  setEmail(e.target.value)
                }}
                placeholder='you@example.com'
                required
                className='mt-1 h-12 w-full rounded-xl border border-white/10 bg-[#1f1f1f] px-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/80 focus:outline-none'
              />
            </label>

            <label className='block text-sm text-slate-300'>
              Password
              <input
                type='password'
                value={password}
                onChange={(e) => {
                  clearError()
                  setPassword(e.target.value)
                }}
                placeholder='Enter your password'
                required
                className='mt-1 h-12 w-full rounded-xl border border-white/10 bg-[#1f1f1f] px-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/80 focus:outline-none'
              />
            </label>

            {error && <p className='rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200'>{error}</p>}

            <button
              type='submit'
              disabled={loading}
              className='h-12 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 font-semibold text-white transition hover:brightness-110 disabled:opacity-60'
            >
              {loading ? 'Please wait...' : 'Sign In'}
            </button>
          </form>

          <div className='my-4 flex items-center gap-3'>
            <div className='h-px flex-1 bg-white/15' />
            <span className='text-xs uppercase tracking-[0.18em] text-slate-400'>Or</span>
            <div className='h-px flex-1 bg-white/15' />
          </div>

          <button
            type='button'
            onClick={submitGoogle}
            disabled={loading}
            className='flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-60'
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <p className='mt-5 text-center text-sm text-slate-300'>
            New here?{' '}
            <button onClick={onSwitchToSignup} className='font-semibold text-emerald-300 hover:text-emerald-200 hover:underline'>
              Create account
            </button>
          </p>
        </section>
      </div>
    </div>
  )
}

export default SignInPage
