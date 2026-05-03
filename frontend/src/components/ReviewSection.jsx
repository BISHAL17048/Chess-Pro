import LichessWatch from './LichessWatch'

function ReviewSection({ socket }) {
  return (
    <div className='space-y-0'>
      {/* ── Hero Header ── */}
      <div className='relative overflow-hidden rounded-2xl border border-white/10 bg-[#161616] mb-5'>
        <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_0%_0%,rgba(16,185,129,0.13),transparent_70%)]' />
        <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_60%_at_100%_100%,rgba(6,182,212,0.09),transparent_70%)]' />

        <div className='relative px-6 py-6 md:px-8 md:py-7'>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div className='max-w-2xl'>
              <div className='flex items-center gap-2 mb-2'>
                <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/25'>
                  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' className='h-4 w-4 text-emerald-400'>
                    <path d='M9 3h6v4h3v4h-3v2h3v8H6v-8h3v-2H6V7h3V3Z' />
                    <path d='M12 17v-6' strokeLinecap='round'/>
                  </svg>
                </div>
                <p className='text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400'>Game Review</p>
              </div>
              <h1 className='text-2xl md:text-3xl font-bold text-white leading-tight'>
                Deep Game Analysis
              </h1>
              <p className='mt-2 text-sm text-slate-400 leading-relaxed'>
                Analyze every move with Stockfish engine — accuracy scores, blunders, brilliant moves and opening detection. Works for all your games: online matches and bot games.
              </p>
              <div className='mt-4 flex flex-wrap gap-2'>
                {[
                  { label: 'Stockfish NNUE', color: 'emerald' },
                  { label: 'Eval Graph', color: 'cyan' },
                  { label: 'Move Classification', color: 'violet' },
                  { label: 'Accuracy Score', color: 'amber' },
                  { label: 'Opening Detection', color: 'sky' },
                ].map((chip) => (
                  <span
                    key={chip.label}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold
                      ${chip.color === 'emerald' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25' : ''}
                      ${chip.color === 'cyan'    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25' : ''}
                      ${chip.color === 'violet'  ? 'bg-violet-500/15 text-violet-300 border border-violet-500/25' : ''}
                      ${chip.color === 'amber'   ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25' : ''}
                      ${chip.color === 'sky'     ? 'bg-sky-500/15 text-sky-300 border border-sky-500/25' : ''}
                    `}
                  >
                    <span className='inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80' />
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>

            <div className='hidden md:flex flex-col gap-2 text-right min-w-[140px]'>
              <div className='rounded-xl border border-white/10 bg-white/5 px-4 py-2.5'>
                <p className='text-[10px] uppercase tracking-wide text-slate-400'>Engine</p>
                <p className='text-sm font-bold text-white mt-0.5'>SF 18 NNUE</p>
              </div>
              <div className='rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-2.5'>
                <p className='text-[10px] uppercase tracking-wide text-emerald-400'>Analysis</p>
                <p className='text-sm font-bold text-emerald-300 mt-0.5'>Full Depth</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Single analysis board for all games ── */}
      <LichessWatch
        socket={socket}
        analysisOnly={true}
        hideLiveOptions={false}
      />
    </div>
  )
}

export default ReviewSection
