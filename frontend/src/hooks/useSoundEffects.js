import { useCallback, useEffect, useRef, useState } from 'react'

const SOUND_FILES = {
  move: 'When you move a piece.mp3',
  opponentMove: 'When your opponent moves a piece.mp3',
  capture: 'When you Capture or your opponent does.mp3',
  castle: 'When you Castle or your opponent does.mp3',
  check: 'When you deliver a check or your opponent does.mp3',
  promotion: 'When you promote a piece or your opponent does.mp3',
  illegal: 'illegal move.mp3',
  gameStart: 'When the game starts.mp3',
  gameEnd: 'When the game ends (move-check sound + game-end sound = Checkmate).mp3',
  lowTime: "When there is isn't much time left on the clock.mp3",
  premove: 'when you Pre-move a piece or your opponent does.mp3'
}

function soundUrl(fileName) {
  return `/sounds/${encodeURIComponent(fileName)}`
}

export function useSoundEffects() {
  const [volume, setVolumeState] = useState(0.75)
  const [muted, setMuted] = useState(false)
  const audioMapRef = useRef({})
  const unlockedRef = useRef(false)

  useEffect(() => {
    const map = {}
    Object.entries(SOUND_FILES).forEach(([key, fileName]) => {
      const audio = new Audio(soundUrl(fileName))
      audio.preload = 'auto'
      map[key] = audio
    })
    audioMapRef.current = map
  }, [])

  const unlockAudio = useCallback(() => {
    if (unlockedRef.current) return

    const sounds = Object.values(audioMapRef.current)
    if (!sounds.length) return

    sounds.forEach((audio) => {
      try {
        audio.muted = true
        audio.currentTime = 0
        const promise = audio.play()
        if (promise && typeof promise.then === 'function') {
          promise
            .then(() => {
              audio.pause()
              audio.currentTime = 0
              audio.muted = false
            })
            .catch(() => {})
        }
      } catch {
        // Ignore unlock failures and retry on next interaction.
      }
    })

    unlockedRef.current = true
  }, [])

  useEffect(() => {
    const onFirstGesture = () => unlockAudio()
    window.addEventListener('pointerdown', onFirstGesture, { once: true })
    window.addEventListener('keydown', onFirstGesture, { once: true })
    window.addEventListener('touchstart', onFirstGesture, { once: true })

    return () => {
      window.removeEventListener('pointerdown', onFirstGesture)
      window.removeEventListener('keydown', onFirstGesture)
      window.removeEventListener('touchstart', onFirstGesture)
    }
  }, [unlockAudio])

  const play = useCallback((soundKey) => {
    if (muted) return
    const baseAudio = audioMapRef.current[soundKey]
    if (!baseAudio) return

    try {
      const sound = new Audio(baseAudio.src)
      sound.preload = 'auto'
      sound.volume = Math.max(0, Math.min(1, volume))
      sound.currentTime = 0
      sound.play().catch(() => {
        if (!unlockedRef.current) {
          unlockAudio()
        }
      })
    } catch {
      // Audio failures should never block gameplay.
    }
  }, [muted, volume, unlockAudio])

  const setVolume = useCallback((v) => setVolumeState(Math.max(0, Math.min(1, v))), [])
  const toggleMute = useCallback(() => setMuted((m) => !m), [])

  return {
    volume,
    muted,
    setVolume,
    toggleMute,
    unlockAudio,
    playMove: () => play('move'),
    playOpponentMove: () => play('opponentMove'),
    playCapture: () => play('capture'),
    playCastle: () => play('castle'),
    playCheck: () => play('check'),
    playCheckmate: () => play('gameEnd'),
    playPromotion: () => play('promotion'),
    playIllegal: () => play('illegal'),
    playGameStart: () => play('gameStart'),
    playGameEnd: () => play('gameEnd'),
    playLowTime: () => play('lowTime'),
    playPremove: () => play('premove')
  }
}
