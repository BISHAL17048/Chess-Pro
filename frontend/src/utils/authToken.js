const TOKEN_KEY = 'chess_api_token'

export function getStoredApiToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''
}

export function setStoredApiToken(token) {
  const value = String(token || '').trim()
  if (!value) return
  localStorage.setItem(TOKEN_KEY, value)
  sessionStorage.setItem(TOKEN_KEY, value)
}

export function clearStoredApiToken() {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}
