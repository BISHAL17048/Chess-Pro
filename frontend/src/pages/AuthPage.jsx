import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

function AuthPage() {
  const { signup, login, loading, error } = useAuthStore()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    if (mode === 'signup') {
      await signup({ username, email, password })
    } else {
      await login({ email, password })
    }
  }

  return (
    <div className='grid min-h-screen place-items-center bg-[#1f1f1f] px-4'>
      <div className='w-full max-w-md rounded-2xl border border-white/10 bg-[#262626] p-6'>
        <h1 className='mb-1 text-2xl font-semibold text-white'>Chess Auth</h1>
        <p className='mb-6 text-sm text-slate-400'>Firebase + JWT secured login</p>

        <div className='mb-4 grid grid-cols-2 rounded-xl bg-[#1f1f1f] p-1'>
          <button
            onClick={() => setMode('login')}
            className={`rounded-lg px-3 py-2 text-sm ${mode === 'login' ? 'bg-[#4caf50] text-white' : 'text-slate-300'}`}
          >
            Login
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`rounded-lg px-3 py-2 text-sm ${mode === 'signup' ? 'bg-[#4caf50] text-white' : 'text-slate-300'}`}
          >
            Signup
          </button>
        </div>

        <form className='space-y-3' onSubmit={submit}>
          {mode === 'signup' && (
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder='Username'
              required
              className='h-11 w-full rounded-xl border border-white/10 bg-[#1f1f1f] px-3 text-slate-100 placeholder:text-slate-500 focus:border-[#4caf50]/60 focus:outline-none'
            />
          )}

          <input
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder='Email'
            required
            className='h-11 w-full rounded-xl border border-white/10 bg-[#1f1f1f] px-3 text-slate-100 placeholder:text-slate-500 focus:border-[#4caf50]/60 focus:outline-none'
          />

          <input
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder='Password'
            required
            className='h-11 w-full rounded-xl border border-white/10 bg-[#1f1f1f] px-3 text-slate-100 placeholder:text-slate-500 focus:border-[#4caf50]/60 focus:outline-none'
          />

          {error && <p className='text-sm text-red-300'>{error}</p>}

          <button
            type='submit'
            disabled={loading}
            className='h-11 w-full rounded-xl bg-[#4caf50] font-semibold text-white transition hover:bg-[#43a047] disabled:opacity-60'
          >
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AuthPage
