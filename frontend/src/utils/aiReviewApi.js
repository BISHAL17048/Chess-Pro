export async function generateAiTutorReview(payload) {
  const res = await fetch('/api/ai/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  const data = await res.json()
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Failed to generate AI tutor review')
  }

  return data.data
}

export async function analyzeEngineDeterministic(payload) {
  const res = await fetch('/api/ai/engine-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to run engine analysis')
  }

  return data
}
