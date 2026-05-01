import express from 'express'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeDeterministicEngineData } from '../utils/deterministicEngineAnalysis.js'
import { evaluateDeterministicDrawState } from '../utils/drawDetection.js'

const router = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const OPENINGS_DIR = path.resolve(__dirname, '../../chess-openings-master')
const OPENINGS_FILES = ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv']

let openingsCache = null

async function loadOpeningBook() {
  if (Array.isArray(openingsCache)) {
    return openingsCache
  }

  const rows = []

  for (const fileName of OPENINGS_FILES) {
    const fullPath = path.join(OPENINGS_DIR, fileName)
    const text = await readFile(fullPath, 'utf8')
    const lines = text.split(/\r?\n/)

    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i]
      if (!line) continue

      const [eco, name, pgn] = line.split('\t')
      if (!eco || !name) continue

      rows.push({
        eco: String(eco).trim(),
        name: String(name).trim(),
        pgn: String(pgn || '').trim()
      })
    }
  }

  openingsCache = rows
  return rows
}

router.get('/openings', async (req, res) => {
  try {
    const openings = await loadOpeningBook()
    res.json({
      success: true,
      data: openings
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to load openings'
    })
  }
})

router.post('/engine-analysis', (req, res) => {
  try {
    const analysis = analyzeDeterministicEngineData(req.body || {})
    res.json(analysis)
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message || 'Invalid engine analysis input'
    })
  }
})

router.post('/draw-detection', (req, res) => {
  try {
    const { moves, fen_history, metadata, is_stalemate, is_in_check } = req.body || {}
    const result = evaluateDeterministicDrawState({
      moves: Array.isArray(moves) ? moves : [],
      fenHistory: Array.isArray(fen_history) ? fen_history : [],
      metadata: metadata || {},
      isStalemate: Boolean(is_stalemate),
      isKingInCheck: Boolean(is_in_check)
    })
    res.json(result)
  } catch (error) {
    res.status(400).json({
      is_draw: false,
      type: null,
      error: error.message || 'Invalid draw detection input'
    })
  }
})

router.post('/review', async (req, res) => {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      res.status(500).json({
        success: false,
        error: 'AI review is not configured. Set OPENROUTER_API_KEY in backend environment.'
      })
      return
    }

    const {
      openingName,
      whiteAccuracy,
      blackAccuracy,
      gameSummary,
      keyMoments,
      mistakesWhite,
      mistakesBlack,
      criticalMoves,
      result,
      totalMoves
    } = req.body || {}

    const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'

    const systemPrompt = [
      'You are a world-class chess tutor with a calm, practical style inspired by elite grandmasters.',
      'Write concise, insightful coaching commentary that feels human and encouraging.',
      'Do not invent moves or game facts that are not provided.',
      'Output in Markdown with clear section headings and short bullet points.'
    ].join(' ')

    const userPrompt = `Generate a pro-level chess tutor review with the following sections: Overall Assessment, Key Lessons, Tactical Themes, Positional Themes, Practical Advice, Next Training Plan, and 3 Discussion Questions for multiplayer study.\n\nGame data:\n- Opening: ${openingName || 'Unknown'}\n- Result: ${result || '*'}\n- Total moves: ${totalMoves || 0}\n- White accuracy: ${whiteAccuracy ?? '-'}\n- Black accuracy: ${blackAccuracy ?? '-'}\n\nSummary points:\n${(gameSummary || []).map((x) => `- ${x}`).join('\n')}\n\nCritical moves:\n${(criticalMoves || []).slice(0, 8).map((m) => `- ${m.moveNumber}${m.color === 'w' ? '.' : '...'} ${m.san} | ${m.classification} | loss ${m.lossCp}cp | best ${m.bestMoveUci || '-'}`).join('\n')}\n\nKey moments:\n${(keyMoments || []).slice(0, 6).map((m) => `- ${m.moveNumber}${m.color === 'w' ? '.' : '...'} ${m.san} | swing ${(m.swing / 100).toFixed(2)} pawns`).join('\n')}\n\nWhite mistakes:\n${(mistakesWhite || []).slice(0, 6).map((m) => `- ${m.moveNumber}${m.color === 'w' ? '.' : '...'} ${m.san} | ${m.classification} | best ${m.bestMoveUci || '-'}`).join('\n')}\n\nBlack mistakes:\n${(mistakesBlack || []).slice(0, 6).map((m) => `- ${m.moveNumber}${m.color === 'w' ? '.' : '...'} ${m.san} | ${m.classification} | best ${m.bestMoveUci || '-'}`).join('\n')}\n\nKeep language simple and practical, like coaching a 500-1600 rapid player.`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:5173',
        'X-Title': 'Chess Pro Tutor Review'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 900
      })
    })

    const json = await response.json()

    if (!response.ok) {
      const message = json?.error?.message || `OpenRouter request failed (${response.status})`
      res.status(502).json({ success: false, error: message })
      return
    }

    const content = json?.choices?.[0]?.message?.content || ''
    if (!content) {
      res.status(502).json({ success: false, error: 'Empty AI response from provider' })
      return
    }

    res.json({ success: true, data: { review: content, model } })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate AI review' })
  }
})

export default router
