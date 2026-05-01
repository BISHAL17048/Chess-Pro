function PlayCard({ onPlayOnline, onPlayComputer }) {
  const modes = ['Bullet', 'Blitz', 'Rapid']

  return (
    <section className='rounded-2xl border border-white/10 bg-gradient-to-br from-[#252526]/90 via-[#252526]/90 to-[#252526]/90 p-6 shadow-[0_10px_40px_rgba(0,0,0,.35)]'>
      <div className='mb-5 flex items-center justify-between'>
        <h2 className='text-xl font-semibold text-white'>Play Arena</h2>
        <span className='rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-200'>Live</span>
      </div>

      <button
        onClick={onPlayOnline}
        className='group mb-4 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4 text-base font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_10px_25px_rgba(16,185,129,.35)]'
      >
        Play Online
      </button>

      <div className='mb-4 grid grid-cols-3 gap-2'>
        {modes.map((mode) => (
          <button
            key={mode}
            className='rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/60 hover:text-white'
          >
            {mode}
          </button>
        ))}
      </div>

      <button
        onClick={onPlayComputer}
        className='w-full rounded-xl border border-white/15 bg-transparent px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10 hover:text-white'
      >
        Play vs Computer
      </button>
    </section>
  )
}

export default PlayCard
