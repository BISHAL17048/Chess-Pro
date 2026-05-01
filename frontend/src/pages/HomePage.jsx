import GameBoard from '../components/GameBoard'

function HomePage({ socket, status, apiStatusText }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">♟ Chess Game</h1>
          <p className="text-slate-400">Play chess in real-time</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-700 rounded-lg p-6 text-white">
            <h2 className="text-lg font-semibold mb-2">Server Status</h2>
            <p className={`text-sm ${status === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
              {status === 'connected' ? '✓ Connected' : '✗ Disconnected'}
            </p>
          </div>

          <div className="bg-slate-700 rounded-lg p-6 text-white">
            <h2 className="text-lg font-semibold mb-2">API Status</h2>
            {apiStatusText ? (
              <p className="text-sm text-green-400">✓ {apiStatusText}</p>
            ) : (
              <p className="text-sm text-yellow-400">⟳ Loading...</p>
            )}
          </div>

          <div className="bg-slate-700 rounded-lg p-6 text-white">
            <h2 className="text-lg font-semibold mb-2">Game Status</h2>
            <p className="text-sm text-blue-400">Ready to play</p>
          </div>
        </div>

        <div className="flex justify-center">
          <GameBoard socket={socket} />
        </div>
      </div>
    </div>
  )
}

export default HomePage
