import { BOARD_THEMES, useBoardThemeStore } from '../store/useBoardThemeStore'
import { useAuthStore } from '../store/useAuthStore'

const navItems = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'play', label: 'Play', icon: 'play' },
  { id: 'puzzles', label: 'Puzzles', icon: 'puzzle' },
  { id: 'learn', label: 'Learn', icon: 'learn' },
  { id: 'watch', label: 'Watch', icon: 'watch' },
  { id: 'news', label: 'Review', icon: 'news' },
  { id: 'social', label: 'Social', icon: 'social' }
]

function Icon({ name, className = 'h-5 w-5' }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7 }

  switch (name) {
    case 'home':
      return <svg {...common}><path d='M3 10.5 12 3l9 7.5v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9Z' /></svg>
    case 'play':
      return <svg {...common}><path d='M8 6v12l10-6-10-6Z' /></svg>
    case 'puzzle':
      return <svg {...common}><path d='M9 3h6v4h3v4h-3v2h3v8H6v-8h3v-2H6V7h3V3Z' /></svg>
    case 'learn':
      return <svg {...common}><path d='M4 6 12 3l8 3-8 3-8-3Zm0 5 8 3 8-3M4 16l8 3 8-3' /></svg>
    case 'watch':
      return <svg {...common}><circle cx='12' cy='12' r='8' /><path d='M12 8v5l3 2' /></svg>
    case 'news':
      return <svg {...common}><path d='M5 4h14v16H5z' /><path d='M8 8h8M8 12h8M8 16h5' /></svg>
    default:
      return <svg {...common}><path d='M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21a8 8 0 0 1 16 0' /></svg>
  }
}

function Sidebar({
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile
}) {
  const themeId = useBoardThemeStore((state) => state.themeId)
  const setThemeId = useBoardThemeStore((state) => state.setThemeId)
  const user = useAuthStore((state) => state.user)
  const displayName = String(user?.displayName || user?.username || 'Player')
  const email = String(user?.email || '')
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'P'

  return (
    <>
      {mobileOpen && (
        <button
          onClick={onCloseMobile}
          className='fixed inset-0 z-20 bg-black/55 md:hidden'
          aria-label='Close navigation'
        />
      )}

      <aside
        className={[
          'fixed left-0 top-0 z-30 h-screen border-r border-white/10 bg-[#1f1f1f]/95 backdrop-blur transition-all duration-300',
          collapsed ? 'w-[88px] px-2 py-3' : 'w-[248px] px-3 py-4',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        ].join(' ')}
      >
        <div className='flex h-full flex-col'>
        <div className={collapsed ? 'mb-4 flex flex-col items-center gap-2' : 'mb-4 flex items-center justify-between px-2'}>
          <div className={collapsed ? 'flex justify-center' : 'flex items-center gap-3 rounded-xl px-1 py-1'}>
            <img 
              src='/logo-icon.svg' 
              alt='Chess Pro' 
              className={`${collapsed ? 'h-10 w-10' : 'h-12 w-12'} rounded-xl`}
            />
            {!collapsed && (
              <div className="flex flex-col">
                <span className='text-lg font-black tracking-wider leading-none'>
                  <span className='text-white'>CHESS</span>
                  <span className='text-[#D4AF37] ml-1'>PRO</span>
                </span>
                <span className='text-[10px] tracking-[0.15em] text-[#D4AF37] uppercase mt-0.5'>Play • Learn • Master</span>
              </div>
            )}
          </div>
          <button
            onClick={onToggleCollapse}
            className='hidden rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white md:block'
            aria-label='Toggle sidebar'
          >
            <svg className='h-4 w-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d={collapsed ? 'M9 18l6-6-6-6' : 'M15 18 9 12l6-6'} />
            </svg>
          </button>
        </div>

        <nav className={collapsed ? 'space-y-2' : 'space-y-1'}>
          {navItems.map((item) => {
            const isActive = activePage === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id)
                  onCloseMobile()
                }}
                className={[
                  collapsed
                    ? 'group flex h-12 w-full items-center justify-center rounded-2xl transition'
                    : 'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-400/15 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(16,185,129,.45)]'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                ].join(' ')}
              >
                <Icon name={item.icon} className='h-5 w-5' />
                {!collapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className='mt-auto space-y-3'>
          {!collapsed && (
            <div className='rounded-xl border border-white/10 bg-[#252526] p-3'>
              <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300'>Board Theme</p>
              <div className='grid grid-cols-2 gap-2'>
                {BOARD_THEMES.map((theme) => {
                  const selected = theme.id === themeId
                  return (
                    <button
                      key={theme.id}
                      onClick={() => setThemeId(theme.id)}
                      className={[
                        'rounded-lg border px-2 py-1.5 text-xs text-slate-200 transition',
                        selected
                          ? 'border-cyan-300/70 bg-cyan-400/10'
                          : 'border-white/10 bg-[#2d2d30] hover:border-white/25'
                      ].join(' ')}
                    >
                      <div className='mb-1 flex h-5 overflow-hidden rounded border border-black/20'>
                        <span className='block h-full flex-1' style={{ backgroundColor: theme.light }} />
                        <span className='block h-full flex-1' style={{ backgroundColor: theme.dark }} />
                      </div>
                      {theme.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className={[
            'rounded-xl border border-white/10 bg-[#252526] transition',
            collapsed ? 'flex items-center justify-center p-2' : 'p-2'
          ].join(' ')}>
            {collapsed ? (
              <div className='grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-emerald-500 text-sm font-semibold text-white'>
                {initials}
              </div>
            ) : (
              <div className='flex items-center gap-2 rounded-lg px-2 py-1'>
                <div className='grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-emerald-500 text-xs font-semibold text-white'>
                  {initials}
                </div>
                <div className='min-w-0'>
                  <p className='truncate text-sm font-semibold text-white'>{displayName}</p>
                  <p className='truncate text-[11px] text-slate-400'>{email || 'No email'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
