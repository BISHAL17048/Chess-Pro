import GameBoard from '../components/GameBoard'

function StatusPill({ label, value, color = 'slate' }) {
  const colorMap = {
    slate: 'text-slate-300 bg-[rgba(255,255,255,0.02)] border-white/6',
    green: 'text-emerald-300 bg-emerald-500/6',
    yellow: 'text-amber-300 bg-amber-500/6',
    red: 'text-red-300 bg-red-500/6'
  }
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${colorMap[color]}`}>
      <span className="text-xs opacity-80">{label}</span>
      <span className="text-xs opacity-95">{value}</span>
    </div>
  )
}

function HomePage({ socket, status, apiStatusText }) {
  return (
    <div className="min-h-screen">
      <div className="chess-page py-8">
        <div className="chess-hero p-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-8">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-emerald-300">Welcome</p>
              <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">Chess Dashboard</h1>
              <p className="mt-3 text-slate-300 max-w-2xl">Everything in one place: quick play, puzzles, lessons, live watch and full game review.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => window.location.hash = '/play'} className="chess-btn-primary">Play</button>
                <button onClick={() => window.location.hash = '/puzzles'} className="chess-btn-secondary">Solve Puzzle</button>
                <button onClick={() => window.location.hash = '/analysis'} className="chess-btn-secondary">Analyze Game</button>
              </div>
            </div>

            <div className="md:col-span-4">
              <div className="chess-card">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">Live Overview</h3>
                  <span className="text-xs text-slate-400">~37k online</span>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  <StatusPill label="Server" value={status === 'connected' ? 'Connected' : 'Offline'} color={status === 'connected' ? 'green' : 'red'} />
                  <StatusPill label="API" value={apiStatusText ? apiStatusText : 'Loading'} color={apiStatusText ? 'green' : 'yellow'} />
                  <StatusPill label="Game" value={'Ready'} color={'slate'} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="chess-card">
            <h4 className="text-lg font-bold text-white">Play</h4>
            <p className="text-sm text-slate-300 mt-2">Jump into live matches and challenges.</p>
            <div className="mt-4"><button onClick={() => window.location.hash = '/play'} className="chess-btn-primary">Play Now</button></div>
          </div>

          <div className="chess-card">
            <h4 className="text-lg font-bold text-white">Puzzles</h4>
            <p className="text-sm text-slate-300 mt-2">Solve tactical puzzles and improve accuracy.</p>
            <div className="mt-4"><button onClick={() => window.location.hash = '/puzzles'} className="chess-btn-secondary">Solve Puzzles</button></div>
          </div>

          <div className="chess-card">
            <h4 className="text-lg font-bold text-white">Game Review</h4>
            <p className="text-sm text-slate-300 mt-2">Analyze mistakes and find improvements with engine support.</p>
            <div className="mt-4"><button onClick={() => window.location.hash = '/review'} className="chess-btn-secondary">Open Review</button></div>
          </div>
        </div>

        <div className="mt-6">
          <div className="chess-card p-6">
            <h3 className="text-lg font-bold text-white mb-3">Featured Live Board</h3>
            <div className="flex justify-center">
              <GameBoard socket={socket} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
