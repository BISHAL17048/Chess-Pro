import { useCallback, useEffect, useRef, useState } from 'react'

// Offline-only engine files served from frontend/public/stockfish.
const STOCKFISH_PRIMARY_PATH = 'stockfish/stockfish-18-single.js'
const STOCKFISH_FALLBACK_PATH = 'stockfish/stockfish-18-lite-single.js'
const ENGINE_INIT_TIMEOUT_MS = 12000
const NNUE_MODE_STORAGE_KEY = 'chess.nnue.mode'
const NNUE_MODEL_STORAGE_KEY = 'chess.nnue.model'
const NNUE_NETWORK_OPTIONS = [
  {
    id: 'stockfish-nnue-104mb',
    label: 'STOCKFISH NNUE 104 MB',
    fileName: 'nn-c288c895ea92.nnue',
    filePath: 'stockfish/nn-c288c895ea92.nnue'
  },
  {
    id: 'stockfish-nnue-3.4mb',
    label: 'STOCKFISH NNUE 3.4 MB NNUE',
    fileName: 'nn-37f18f62d772.nnue',
    filePath: 'stockfish/nn-37f18f62d772.nnue'
  }
]

function readStoredNnueMode(defaultValue = true) {
  if (typeof window === 'undefined') return defaultValue
  try {
    const raw = window.localStorage.getItem(NNUE_MODE_STORAGE_KEY)
    if (raw === 'true') return true
    if (raw === 'false') return false
    return defaultValue
  } catch {
    return defaultValue
  }
}

function readStoredNnueModelId(defaultId) {
  if (typeof window === 'undefined') return defaultId
  try {
    const raw = window.localStorage.getItem(NNUE_MODEL_STORAGE_KEY)
    return raw ? normalizeNnueNetworkId(raw) : defaultId
  } catch {
    return defaultId
  }
}

function normalizeNnueNetworkId(inputId) {
  const key = String(inputId || '').trim().toLowerCase()
  const legacyKey = key
    .replace('stockfish-nune-104mb', 'stockfish-nnue-104mb')
    .replace('stockfish-nune-3.4mb', 'stockfish-nnue-3.4mb')
  const found = NNUE_NETWORK_OPTIONS.find((row) => row.id === legacyKey)
  return found ? found.id : NNUE_NETWORK_OPTIONS[0].id
}

function getNnueNetworkById(inputId) {
  const id = normalizeNnueNetworkId(inputId)
  return NNUE_NETWORK_OPTIONS.find((row) => row.id === id) || NNUE_NETWORK_OPTIONS[0]
}

function toAbsoluteEngineUrl(path) {
  if (typeof window === 'undefined') return `/${String(path || '').replace(/^\/+/, '')}`
  const cleanPath = String(path || '').replace(/^\/+/, '')
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '/')
  return new URL(cleanPath, `${window.location.origin}${base}`).toString()
}

function parseEvaluation(line) {
  if (!line.startsWith('info ') || !line.includes(' score ')) return null

  const cpMatch = line.match(/score cp (-?\d+)/)
  const mateMatch = line.match(/score mate (-?\d+)/)
  const pvMatch = line.match(/ pv (.+)$/)
  const depthMatch = line.match(/ depth (\d+)/)
  const isBound = /\b(lowerbound|upperbound)\b/.test(line)
  const depth = depthMatch ? Number(depthMatch[1]) : 0

  if (cpMatch) {
    return {
      type: 'cp',
      value: Number(cpMatch[1]),
      pv: pvMatch ? pvMatch[1] : '',
      depth,
      isBound
    }
  }

  if (mateMatch) {
    return {
      type: 'mate',
      value: Number(mateMatch[1]),
      pv: pvMatch ? pvMatch[1] : '',
      depth,
      isBound
    }
  }

  return null
}

function computeStrengthProfile() {
  const nav = typeof navigator !== 'undefined' ? navigator : null
  const isolated = typeof window !== 'undefined' ? Boolean(window.crossOriginIsolated) : false

  const rawThreads = Number(nav?.hardwareConcurrency || 4)
  const safeThreadsCap = isolated ? 6 : 1
  const threads = Number.isFinite(rawThreads)
    ? Math.max(1, Math.min(safeThreadsCap, Math.floor(rawThreads)))
    : 1

  const rawDeviceMemoryGb = Number(nav?.deviceMemory || 8)
  const memoryMb = Number.isFinite(rawDeviceMemoryGb)
    ? Math.max(1024, Math.floor(rawDeviceMemoryGb * 1024))
    : 4096

  const hashMb = Math.max(96, Math.min(384, Math.floor(memoryMb * 0.2)))

  return {
    threads,
    hashMb,
    // Keep max profile conservative to avoid browser worker crashes on power changes.
    maxThreads: Math.max(1, Math.min(safeThreadsCap, Math.floor(rawThreads || 2))),
    maxHashMb: Math.max(192, Math.min(512, Math.floor(memoryMb * 0.3)))
  }
}

function getPowerConfig(mode, profile) {
  const safeMode = mode === 'max' || mode === 'strong' ? mode : 'balanced'

  if (safeMode === 'max') {
    return {
      threads: profile.maxThreads,
      hashMb: profile.maxHashMb,
      multipv: 1
    }
  }

  if (safeMode === 'strong') {
    return {
      threads: profile.threads,
      hashMb: profile.hashMb,
      multipv: 2
    }
  }

  return {
    threads: Math.max(1, Math.floor(profile.threads * 0.6)),
    hashMb: Math.max(64, Math.floor(profile.hashMb * 0.7)),
    multipv: 2
  }
}

export function useStockfish() {
  const initialNnueMode = readStoredNnueMode(true)
  const initialNnueModelId = readStoredNnueModelId(NNUE_NETWORK_OPTIONS[0].id)
  const workerRef = useRef(null)
  const restartEngineRef = useRef(null)
  const pendingAsyncRef = useRef(null)
  const latestEvaluationRef = useRef(null)
  const pvLinesRef = useRef([])
  const uciOptionsRef = useRef(new Set())
  const enginePathRef = useRef(toAbsoluteEngineUrl(STOCKFISH_PRIMARY_PATH))
  const strengthProfileRef = useRef(computeStrengthProfile())
  const powerModeRef = useRef('max')
  const analysisDepthRef = useRef(20)
  const desiredVariantRef = useRef(initialNnueMode ? 'nnue' : 'classic')
  const selectedNnueNetworkIdRef = useRef(initialNnueModelId)
  const skillLevelRef = useRef(20)
  const analysisCacheRef = useRef(new Map())
  const activeAnalysisKeyRef = useRef('')
  const [ready, setReady] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [bestMove, setBestMove] = useState('')
  const [evaluation, setEvaluation] = useState(null)
  const [pvLines, setPvLines] = useState([])
  const [skillLevel, setSkillLevelState] = useState(20)
  const [powerMode, setPowerModeState] = useState('max')
  const [analysisDepth, setAnalysisDepthState] = useState(20)
  const [error, setError] = useState('')
  const [nnueEnabled, setNnueEnabled] = useState(false)
  const [nnueMode, setNnueModeState] = useState(initialNnueMode)
  const [selectedNnueNetworkId, setSelectedNnueNetworkIdState] = useState(initialNnueModelId)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(NNUE_MODE_STORAGE_KEY, nnueMode ? 'true' : 'false')
    } catch {
      // Ignore storage write failures.
    }
  }, [nnueMode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(NNUE_MODEL_STORAGE_KEY, selectedNnueNetworkId)
    } catch {
      // Ignore storage write failures.
    }
  }, [selectedNnueNetworkId])

  useEffect(() => {
    let active = true
    let restartCount = 0
    let currentEngineKey = STOCKFISH_PRIMARY_PATH
    let currentPath = toAbsoluteEngineUrl(STOCKFISH_PRIMARY_PATH)
    let initTimeoutId = null

    const resetAnalysisState = () => {
      setIsAnalyzing(false)
      setBestMove('')
      setEvaluation(null)
      latestEvaluationRef.current = null
      pvLinesRef.current = []
      setPvLines([])
    }

    const cancelPending = (message) => {
      if (pendingAsyncRef.current) {
        pendingAsyncRef.current.reject(new Error(message))
        pendingAsyncRef.current = null
      }
    }

    const applyStrengthOptions = (worker) => {
      const options = uciOptionsRef.current
      const powerConfig = getPowerConfig(powerModeRef.current, strengthProfileRef.current)

      if (options.has('UCI_LimitStrength')) {
        worker.postMessage('setoption name UCI_LimitStrength value false')
      }

      if (options.has('Skill Level')) {
        worker.postMessage(`setoption name Skill Level value ${skillLevelRef.current}`)
      }

      if (options.has('Threads')) {
        worker.postMessage(`setoption name Threads value ${powerConfig.threads}`)
      }

      if (options.has('Hash')) {
        worker.postMessage(`setoption name Hash value ${powerConfig.hashMb}`)
      }

      if (options.has('MultiPV')) {
        worker.postMessage(`setoption name MultiPV value ${powerConfig.multipv}`)
      }
    }

    const applyNnueOptions = (worker, { forceMode } = {}) => {
      const options = uciOptionsRef.current
      const enableNnue = typeof forceMode === 'boolean' ? forceMode : desiredVariantRef.current === 'nnue'
      const selectedNetwork = getNnueNetworkById(selectedNnueNetworkIdRef.current)

      if (options.has('Use NNUE')) {
        worker.postMessage(`setoption name Use NNUE value ${enableNnue ? 'true' : 'false'}`)
      }

      if (enableNnue && options.has('EvalFile')) {
        worker.postMessage(`setoption name EvalFile value ${selectedNetwork.fileName}`)
      }

      if (options.has('Use NNUE')) {
        setNnueEnabled(enableNnue)
      } else {
        const inferredNnue = enableNnue && currentEngineKey === STOCKFISH_PRIMARY_PATH
        setNnueEnabled(inferredNnue)
      }
    }

    const clearInitTimeout = () => {
      if (initTimeoutId) {
        clearTimeout(initTimeoutId)
        initTimeoutId = null
      }
    }

    const tryStartWorker = (path) => {
      try {
        return new Worker(path)
      } catch {
        try {
          return new Worker(new URL(path))
        } catch {
          return null
        }
      }
    }

    const resolvePathWithFallback = (path) => {
      const absolute = toAbsoluteEngineUrl(path)
      return {
        absolute,
        fallbackAbsolute: new URL(String(path || '').replace(/^\/+/, ''), window.location.origin).toString()
      }
    }

    const probeAsset = async (url) => {
      try {
        const response = await fetch(url, { method: 'GET', cache: 'no-store' })
        return response.ok
      } catch {
        return null
      }
    }

    const startEngine = async (path, isRecovery = false) => {
      if (!active) return

      clearInitTimeout()

      const resolved = resolvePathWithFallback(path)
      let workerUrl = resolved.absolute
      const probeOk = await probeAsset(workerUrl)
      if (probeOk !== true) {
        workerUrl = resolved.fallbackAbsolute
      }

      const worker = tryStartWorker(workerUrl)
      if (!worker) {
        if (path !== STOCKFISH_FALLBACK_PATH) {
          void startEngine(STOCKFISH_FALLBACK_PATH, true)
          return
        }
        setReady(false)
        setNnueEnabled(false)
        resetAnalysisState()
        setError('Stockfish failed to initialize')
        cancelPending('Stockfish worker error')
        return
      }

      currentPath = workerUrl
      currentEngineKey = path
      enginePathRef.current = workerUrl
      workerRef.current = worker
      uciOptionsRef.current = new Set()
      setReady(false)

      initTimeoutId = setTimeout(() => {
        if (!active || workerRef.current !== worker || ready) return
        try {
          worker.terminate()
        } catch {
          // Ignore termination failure.
        }

        workerRef.current = null
        setReady(false)
        setNnueEnabled(false)
        resetAnalysisState()
        cancelPending('Stockfish initialization timed out')

        if (path !== STOCKFISH_FALLBACK_PATH) {
          setError('Stockfish loading timed out, trying fallback...')
          void startEngine(STOCKFISH_FALLBACK_PATH, true)
          return
        }

        setError('Stockfish failed to initialize')
      }, ENGINE_INIT_TIMEOUT_MS)

      worker.onmessage = (event) => {
        const line = String(event.data || '')

        if (!active || workerRef.current !== worker) return

        if (line.startsWith('option name ')) {
          const namePart = line.slice('option name '.length)
          const optionName = (namePart.split(' type ')[0] || '').trim()
          if (optionName) {
            uciOptionsRef.current.add(optionName)
          }
          return
        }

        if (line.includes('uciok')) {
          applyStrengthOptions(worker)
          applyNnueOptions(worker)
          worker.postMessage('isready')
          return
        }

        if (line.includes('readyok')) {
          clearInitTimeout()
          setError('')
          setReady(true)
          return
        }

        const evalData = parseEvaluation(line)
        if (evalData && !evalData.isBound) {
          const prevEvalDepth = Number(latestEvaluationRef.current?.depth || 0)
          const nextEvalDepth = Number(evalData.depth || 0)
          if (nextEvalDepth + 1 >= prevEvalDepth) {
            latestEvaluationRef.current = evalData
            setEvaluation(evalData)
          }

          const mpvMatch = line.match(/ multipv (\d+)/)
          const pvMatch = line.match(/ pv (.+)$/)
          if (pvMatch) {
            const idx = mpvMatch ? Number(mpvMatch[1]) - 1 : 0
            const bestMoveUci = (pvMatch[1] || '').trim().split(' ')[0] || ''
            pvLinesRef.current = [...pvLinesRef.current]
            const prevLineDepth = Number(pvLinesRef.current[idx]?.depth || 0)
            if (nextEvalDepth + 1 >= prevLineDepth) {
              pvLinesRef.current[idx] = { ...evalData, bestMove: bestMoveUci, pv: (pvMatch[1] || '').trim() }
            }
            setPvLines([...pvLinesRef.current])
          }
          return
        }

        if (line.startsWith('bestmove')) {
          const move = line.split(' ')[1] || ''
          setBestMove(move)
          setIsAnalyzing(false)

          const finishedKey = activeAnalysisKeyRef.current
          if (finishedKey) {
            analysisCacheRef.current.set(finishedKey, {
              bestMove: move,
              evaluation: latestEvaluationRef.current,
              pvLines: [...pvLinesRef.current]
            })
          }

          const pending = pendingAsyncRef.current
          if (pending) {
            pendingAsyncRef.current = null
            pending.resolve({
              bestMove: move,
              evaluation: latestEvaluationRef.current
            })
          }
        }
      }

      worker.onerror = () => {
        if (!active || workerRef.current !== worker) return

        clearInitTimeout()

        try {
          worker.terminate()
        } catch {
          // Ignore termination failure.
        }

        restartCount += 1
        setReady(false)
        resetAnalysisState()
        cancelPending('Analysis canceled: engine restarting')

        if (restartCount <= 2) {
          const nextPath = currentEngineKey === STOCKFISH_PRIMARY_PATH ? STOCKFISH_FALLBACK_PATH : STOCKFISH_PRIMARY_PATH
          if (nextPath === STOCKFISH_FALLBACK_PATH) {
            // Reduce settings while recovering on lite engine.
            desiredVariantRef.current = 'classic'
            setNnueModeState(false)
            setNnueEnabled(false)
            powerModeRef.current = 'balanced'
            setPowerModeState('balanced')
          }
          setError(isRecovery ? 'Stockfish restarting...' : 'Stockfish worker crashed, restarting...')
          void startEngine(nextPath, true)
          return
        }

        setNnueEnabled(false)
        setError('Stockfish failed to initialize')
      }

      worker.postMessage('uci')
    }

    const restartEngine = (path, message = 'Stockfish restarting...') => {
      if (!active) return
      clearInitTimeout()
      const current = workerRef.current
      if (current) {
        try {
          current.terminate()
        } catch {
          // Ignore termination failure.
        }
      }
      setReady(false)
      setError(message)
      cancelPending('Analysis canceled: engine restarting')
      void startEngine(path, true)
    }

    restartEngineRef.current = restartEngine

    void startEngine(STOCKFISH_PRIMARY_PATH)

    return () => {
      active = false
      clearInitTimeout()
      restartEngineRef.current = null
      cancelPending('Stockfish worker terminated')
      if (workerRef.current) {
        workerRef.current.terminate()
      }
      uciOptionsRef.current = new Set()
    }
  }, [])

  const analyzeFen = useCallback((fen, depth) => {
    const worker = workerRef.current
    if (!worker) return
    if (!ready) {
      setError('Stockfish is still loading')
      return
    }

    const cacheKey = [
      'sync',
      fen,
      Math.max(8, Math.min(30, Math.floor(depth ?? analysisDepthRef.current))),
      powerModeRef.current,
      desiredVariantRef.current,
      selectedNnueNetworkIdRef.current,
      skillLevelRef.current
    ].join('|')

    const cached = analysisCacheRef.current.get(cacheKey)
    if (cached) {
      setError('')
      setIsAnalyzing(false)
      activeAnalysisKeyRef.current = cacheKey
      setBestMove(cached.bestMove || '')
      setEvaluation(cached.evaluation || null)
      pvLinesRef.current = Array.isArray(cached.pvLines) ? [...cached.pvLines] : []
      setPvLines(pvLinesRef.current)
      latestEvaluationRef.current = cached.evaluation || null
      return
    }

    setError('')
    setIsAnalyzing(true)
    activeAnalysisKeyRef.current = cacheKey
    setBestMove('')
    setEvaluation(null)
    pvLinesRef.current = []
    setPvLines([])
    latestEvaluationRef.current = null

    worker.postMessage('stop')
    worker.postMessage('ucinewgame')
    worker.postMessage(`position fen ${fen}`)
    worker.postMessage(`go depth ${Math.max(8, Math.min(30, Math.floor(depth ?? analysisDepthRef.current)))}`)
  }, [ready])

  const analyzeFenAsync = useCallback((fen, depth) => {
    const worker = workerRef.current
    const resolvedDepth = Math.max(8, Math.min(30, Math.floor(depth ?? analysisDepthRef.current)))
    const cacheKey = [
      'async',
      fen,
      resolvedDepth,
      powerModeRef.current,
      desiredVariantRef.current,
      selectedNnueNetworkIdRef.current,
      skillLevelRef.current
    ].join('|')

    const cached = analysisCacheRef.current.get(cacheKey)

    return new Promise((resolve, reject) => {
      if (!worker) {
        reject(new Error('Stockfish worker unavailable'))
        return
      }

      if (!ready) {
        reject(new Error('Stockfish is still loading'))
        return
      }

      if (cached) {
        setError('')
        setIsAnalyzing(false)
        setBestMove(cached.bestMove || '')
        setEvaluation(cached.evaluation || null)
        pvLinesRef.current = Array.isArray(cached.pvLines) ? [...cached.pvLines] : []
        setPvLines(pvLinesRef.current)
        latestEvaluationRef.current = cached.evaluation || null
        resolve(cached)
        return
      }

      if (pendingAsyncRef.current) {
        pendingAsyncRef.current.reject(new Error('Previous analysis canceled'))
      }

      pendingAsyncRef.current = { resolve, reject, cacheKey }
      setError('')
      setIsAnalyzing(true)
      activeAnalysisKeyRef.current = cacheKey
      setBestMove('')
      setEvaluation(null)
      pvLinesRef.current = []
      setPvLines([])
      latestEvaluationRef.current = null

      worker.postMessage('stop')
      worker.postMessage('ucinewgame')
      worker.postMessage(`position fen ${fen}`)
      worker.postMessage(`go depth ${resolvedDepth}`)
    })
  }, [ready])

  const stop = useCallback(() => {
    if (!workerRef.current) return
    workerRef.current.postMessage('stop')
    setIsAnalyzing(false)
    activeAnalysisKeyRef.current = ''

    if (pendingAsyncRef.current) {
      pendingAsyncRef.current.reject(new Error('Analysis stopped'))
      pendingAsyncRef.current = null
    }
  }, [])

  const setNnueMode = useCallback((enabled) => {
    const worker = workerRef.current
    if (!worker) return

    desiredVariantRef.current = enabled ? 'nnue' : 'classic'
    setNnueModeState(enabled)
    setReady(false)
    setIsAnalyzing(false)
    setBestMove('')
    setEvaluation(null)
    latestEvaluationRef.current = null
    setError('')
    activeAnalysisKeyRef.current = ''

    if (pendingAsyncRef.current) {
      pendingAsyncRef.current.reject(new Error('Analysis canceled: engine mode changed'))
      pendingAsyncRef.current = null
    }

    if (enabled && !String(enginePathRef.current || '').includes(STOCKFISH_PRIMARY_PATH)) {
      const restart = restartEngineRef.current
      if (typeof restart === 'function') {
        restart(STOCKFISH_PRIMARY_PATH, 'Switching to NNUE engine...')
        return
      }
    }

    const options = uciOptionsRef.current
    const supportsNnue = options.has('Use NNUE')

    // Some offline builds do not expose `Use NNUE` as a UCI option.
    // In that case, emulate NNUE toggle by switching engine binaries:
    // - ON  -> full stockfish build
    // - OFF -> lite build
    if (!supportsNnue) {
      const restart = restartEngineRef.current
      if (typeof restart === 'function') {
        const targetPath = enabled ? STOCKFISH_PRIMARY_PATH : STOCKFISH_FALLBACK_PATH
        restart(targetPath, enabled ? 'Switching to NNUE engine...' : 'Switching to classic engine...')
        return
      }
    }

    worker.postMessage('stop')
    if (supportsNnue) {
      const selectedNetwork = getNnueNetworkById(selectedNnueNetworkIdRef.current)
      worker.postMessage(`setoption name Use NNUE value ${enabled ? 'true' : 'false'}`)
      if (enabled && options.has('EvalFile')) {
        worker.postMessage(`setoption name EvalFile value ${selectedNetwork.fileName}`)
      }
    }
    setNnueEnabled(enabled && supportsNnue)
    worker.postMessage('isready')
  }, [])

  const setNnueNetwork = useCallback((networkId) => {
    const worker = workerRef.current
    const normalized = normalizeNnueNetworkId(networkId)
    const selectedNetwork = getNnueNetworkById(normalized)

    selectedNnueNetworkIdRef.current = normalized
    setSelectedNnueNetworkIdState(normalized)

    if (!worker) return
    if (!nnueMode) return

    const options = uciOptionsRef.current
    if (!options.has('EvalFile')) return

    setReady(false)
    setIsAnalyzing(false)
    worker.postMessage('stop')
    activeAnalysisKeyRef.current = ''
    if (pendingAsyncRef.current) {
      pendingAsyncRef.current.reject(new Error('Analysis canceled: NNUE network changed'))
      pendingAsyncRef.current = null
    }
    worker.postMessage(`setoption name EvalFile value ${selectedNetwork.fileName}`)
    worker.postMessage('isready')
  }, [nnueMode])

  const setSkillLevel = useCallback((level) => {
    const worker = workerRef.current
    const clamped = Math.max(0, Math.min(20, Math.floor(level)))
    skillLevelRef.current = clamped
    setSkillLevelState(clamped)
    if (!worker) return
    const opts = uciOptionsRef.current
    if (opts.has('Skill Level')) {
      worker.postMessage(`setoption name Skill Level value ${clamped}`)
    }
    const limitStrength = clamped < 20
    if (opts.has('UCI_LimitStrength')) {
      worker.postMessage(`setoption name UCI_LimitStrength value ${limitStrength}`)
    }
    if (opts.has('UCI_Elo') && limitStrength) {
      const elo = Math.round(800 + (clamped / 19) * 2000)
      worker.postMessage(`setoption name UCI_Elo value ${elo}`)
    }
  }, [])

  const setPowerMode = useCallback((mode) => {
    const worker = workerRef.current
    const nextMode = mode === 'max' || mode === 'strong' ? mode : 'balanced'
    powerModeRef.current = nextMode
    setPowerModeState(nextMode)

    if (!worker) return

    const options = uciOptionsRef.current
    const powerConfig = getPowerConfig(nextMode, strengthProfileRef.current)

    // Apply option changes only in idle state to prevent engine instability.
    setReady(false)
    setIsAnalyzing(false)
    worker.postMessage('stop')
    if (pendingAsyncRef.current) {
      pendingAsyncRef.current.reject(new Error('Analysis canceled: engine power changed'))
      pendingAsyncRef.current = null
    }

    if (options.has('Threads')) {
      worker.postMessage(`setoption name Threads value ${powerConfig.threads}`)
    }
    if (options.has('Hash')) {
      worker.postMessage(`setoption name Hash value ${powerConfig.hashMb}`)
    }
    if (options.has('MultiPV')) {
      worker.postMessage(`setoption name MultiPV value ${powerConfig.multipv}`)
    }
    worker.postMessage('isready')
  }, [])

  const setAnalysisDepth = useCallback((depth) => {
    const clamped = Math.max(8, Math.min(30, Math.floor(depth || 16)))
    analysisDepthRef.current = clamped
    setAnalysisDepthState(clamped)
  }, [])

  return {
    ready,
    nnueEnabled,
    nnueMode,
    nnueNetworks: NNUE_NETWORK_OPTIONS,
    selectedNnueNetworkId,
    isAnalyzing,
    bestMove,
    evaluation,
    pvLines,
    skillLevel,
    powerMode,
    analysisDepth,
    error,
    analyzeFen,
    analyzeFenAsync,
    stop,
    setNnueMode,
    setNnueNetwork,
    setSkillLevel,
    setPowerMode,
    setAnalysisDepth
  }
}
