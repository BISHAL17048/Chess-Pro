import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import Sidebar from './components/Sidebar'
import Navbar from './components/Navbar'
import HomeSection from './components/HomeSection'
import PlaySection from './components/PlaySection'
import LearnSection from './components/LearnSection'
import PuzzleHub from './components/PuzzleHub'
import WatchSection from './components/WatchSection'
import ReviewSection from './components/ReviewSection'
import SocialSection from './components/SocialSection'
import MyProfileSection from './components/MyProfileSection'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import IntroAnimation from './components/IntroAnimation'
import { useAppStore } from './store/useAppStore'
import { useAuthStore } from './store/useAuthStore'

function App() {
  const {
    socket,
    status,
    apiStatusText,
    activePage,
    collapsed,
    mobileOpen,
    setSocket,
    setStatus,
    setApiStatusText,
    setActivePage,
    toggleCollapsed,
    setMobileOpen
  } = useAppStore()

  const socketUrl = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://127.0.0.1:5000' : window.location.origin)
  const [authScreen, setAuthScreen] = useState('signin')
  const [showIntro, setShowIntro] = useState(true)

  const { user, loading, initializeAuth, logout } = useAuthStore()

  const handleIntroComplete = () => {
    setShowIntro(false)
  }

  useEffect(() => {
    const unsubscribe = initializeAuth()
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [initializeAuth])

  useEffect(() => {
    if (!user) return

    // Initialize Socket.IO connection
    const newSocket = io(socketUrl, {
      path: '/socket.io',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling'],
      timeout: 20000
    })

    newSocket.on('connect', () => {
      setStatus('connected')
      setApiStatusText('')
      console.log('Connected to server')
    })

    newSocket.on('disconnect', (reason) => {
      setStatus('disconnected')
      console.log('Disconnected from server:', reason)
    })

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message)
      setApiStatusText(`Connection error: ${error.message}`)
    })

    setSocket(newSocket)

    return () => newSocket.close()
  }, [socketUrl, user, setSocket, setStatus])



  if (loading) {
    return (
      <div className='grid min-h-screen place-items-center bg-[#1e1e1e] text-slate-200'>
        <p>Checking authentication...</p>
      </div>
    )
  }

  if (!user) {
    if (authScreen === 'signup') {
      return <SignUpPage onSwitchToSignin={() => setAuthScreen('signin')} />
    }

    return <SignInPage onSwitchToSignup={() => setAuthScreen('signup')} />
  }

  const renderPage = () => {
    if (activePage === 'home') {
      return (
        <HomeSection
          onPlayClick={() => setActivePage('play')}
          onPuzzlesClick={() => setActivePage('puzzles')}
          onWatchClick={() => setActivePage('watch')}
          onLearnClick={() => setActivePage('learn')}
        />
      )
    }

    if (activePage === 'play') {
      return (
        <PlaySection
          socket={socket}
          onLearnClick={() => setActivePage('learn')}
        />
      )
    }

    if (activePage === 'learn') {
      return <LearnSection socket={socket} onPuzzlesClick={() => setActivePage('puzzles')} />
    }

    if (activePage === 'puzzles') {
      return <PuzzleHub />
    }

    if (activePage === 'watch') {
      return <WatchSection socket={socket} />
    }

    if (activePage === 'social') {
      return <SocialSection />
    }

    if (activePage === 'profile') {
      return <MyProfileSection />
    }

    if (activePage === 'review') {
      return <ReviewSection socket={socket} />
    }

    return <HomeSection onPlayClick={() => setActivePage('play')} onPuzzlesClick={() => setActivePage('puzzles')} />
  }

  return (
    <>
      {/* Intro Animation */}
      {showIntro && <IntroAnimation onComplete={handleIntroComplete} />}
      
      <div className='relative h-screen overflow-hidden bg-[#1e1e1e] text-slate-100 flex'>
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(58,58,60,.28),transparent_46%)]' />

      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={`relative flex flex-col flex-1 min-w-0 h-full transition-all duration-300 ${collapsed ? 'md:ml-[96px]' : 'md:ml-[256px]'}`}>
        <Navbar
          onMenuClick={() => setMobileOpen(true)}
          status={status}
          onLogout={logout}
          onProfileClick={() => setActivePage('profile')}
        />

        <main className='flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-5 md:px-7 lg:px-8'>
          {renderPage()}
        </main>
      </div>
    </div>
    </>
  )
}

export default App
