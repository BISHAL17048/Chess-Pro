function GameList({ title, items, actionLabel = 'Open' }) {
  return (
    <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-5 backdrop-blur'>
      <h3 className='mb-4 text-lg font-semibold text-white'>{title}</h3>
      <div className='space-y-3'>
        {items.map((item) => (
          <button
            key={item.id}
            className='w-full rounded-xl border border-white/10 bg-[#2d2d30] p-3 text-left transition hover:border-cyan-300/40 hover:bg-[#333337]'
          >
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-slate-100'>{item.name}</p>
                <p className='text-xs text-slate-400'>{item.subtitle}</p>
              </div>
              <div className='text-right'>
                {item.result && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${item.result === 'Win' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {item.result}
                  </span>
                )}
                <p className='mt-1 text-xs text-slate-400'>{actionLabel}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

export default GameList
