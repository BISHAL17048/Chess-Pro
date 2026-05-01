import { useState, useEffect } from 'react'

function IntroAnimation({ onComplete }) {
  const [phase, setPhase] = useState('hold') // 'hold' | 'zoom' | 'exit'

  useEffect(() => {
    // Hold for 800ms, then zoom for 800ms, then exit for 400ms = 2 seconds total
    const zoomTimer = setTimeout(() => {
      setPhase('zoom')
    }, 800)

    const exitTimer = setTimeout(() => {
      setPhase('exit')
    }, 1600)

    const endTimer = setTimeout(() => {
      if (onComplete) onComplete()
    }, 2000)

    return () => {
      clearTimeout(zoomTimer)
      clearTimeout(exitTimer)
      clearTimeout(endTimer)
    }
  }, [onComplete])

  const getTransform = () => {
    switch (phase) {
      case 'hold':
        return 'scale(1) translateZ(0)'
      case 'zoom':
        return 'scale(2.5) translateZ(300px)'
      case 'exit':
        return 'scale(4) translateZ(500px)'
      default:
        return 'scale(1)'
    }
  }

  const getOpacity = () => {
    switch (phase) {
      case 'hold':
        return 1
      case 'zoom':
        return 0.6
      case 'exit':
        return 0
      default:
        return 1
    }
  }

  const getBlur = () => {
    switch (phase) {
      case 'hold':
        return 'blur(0px)'
      case 'zoom':
        return 'blur(1px)'
      case 'exit':
        return 'blur(4px)'
      default:
        return 'blur(0px)'
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#1a1a1a]"
      style={{
        opacity: phase === 'exit' ? 0 : 1,
        transition: 'opacity 0.4s ease-out',
        perspective: '1000px'
      }}
    >
      <div 
        className="relative flex flex-col items-center justify-center"
        style={{
          transform: getTransform(),
          opacity: getOpacity(),
          filter: getBlur(),
          transition: phase === 'zoom' 
            ? 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.8s ease-out, filter 0.8s ease-out'
            : phase === 'exit'
              ? 'transform 0.4s cubic-bezier(0.55, 0.085, 0.68, 0.53), opacity 0.4s ease-out, filter 0.4s ease-out'
              : 'none'
        }}
      >
        {/* Logo */}
        <div className="relative">
          <img 
            src="/logo.svg" 
            alt="Chess Pro" 
            className="h-56 w-auto drop-shadow-2xl"
            style={{
              filter: 'drop-shadow(0 0 40px rgba(212, 175, 55, 0.5))'
            }}
          />
          
          {/* Animated glow ring */}
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: '0 0 60px 20px rgba(212, 175, 55, 0.4)',
              animation: phase === 'hold' ? 'pulse 0.8s infinite' : 'none',
              opacity: phase === 'exit' ? 0 : 1,
              transition: 'opacity 0.4s ease-out'
            }}
          />
        </div>
        
        {/* Text below logo */}
        <div 
          className="mt-6 text-center"
          style={{
            opacity: phase === 'hold' ? 1 : 0,
            transition: 'opacity 0.3s ease-out'
          }}
        >
          <h1 className="text-3xl font-black tracking-wider">
            <span className="text-white">CHESS</span>
            <span className="text-[#D4AF37] ml-2">PRO</span>
          </h1>
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 50px 15px rgba(212, 175, 55, 0.3); }
          50% { box-shadow: 0 0 80px 30px rgba(212, 175, 55, 0.5); }
        }
      `}</style>
    </div>
  )
}

export default IntroAnimation
