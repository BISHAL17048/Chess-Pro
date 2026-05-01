import { create } from 'zustand'

const STORAGE_KEY = 'board_theme_id'

export const BOARD_THEMES = [
  { id: 'green', label: 'Green', light: '#eeeed2', dark: '#769656' },
  { id: 'brown', label: 'Brown', light: '#f0d9b5', dark: '#b58863' },
  { id: 'blue', label: 'Blue', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'sand', label: 'Sand', light: '#f3e5c8', dark: '#c89b6d' }
]

const DEFAULT_THEME = BOARD_THEMES[0]

function resolveTheme(themeId) {
  return BOARD_THEMES.find((theme) => theme.id === themeId) || DEFAULT_THEME
}

function getStoredThemeId() {
  if (typeof window === 'undefined') return DEFAULT_THEME.id
  const value = window.localStorage.getItem(STORAGE_KEY)
  return resolveTheme(value).id
}

export const useBoardThemeStore = create((set) => ({
  themeId: getStoredThemeId(),

  setThemeId: (themeId) => {
    const resolved = resolveTheme(themeId)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, resolved.id)
    }
    set({ themeId: resolved.id })
  }
}))
