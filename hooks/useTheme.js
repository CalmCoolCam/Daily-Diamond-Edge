'use client'
import { useState, useEffect, useCallback } from 'react'

const THEME_KEY = 'dde_theme'
const DARK = 'dark'
const LIGHT = 'light'

/**
 * Manages light/dark theme.
 * - Reads initial preference from localStorage (key: dde_theme)
 * - Applies/removes 'dark' class on document.documentElement
 * - The inline script in layout.js handles the no-flash initial set before hydration
 * - Persists changes to localStorage
 */
export function useTheme() {
  const [theme, setTheme] = useState(LIGHT)

  // On mount, read the current class (set by the inline no-flash script)
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY) || LIGHT
    setTheme(stored)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === DARK ? LIGHT : DARK
      try {
        if (next === DARK) {
          document.documentElement.classList.add(DARK)
        } else {
          document.documentElement.classList.remove(DARK)
        }
        localStorage.setItem(THEME_KEY, next)
      } catch {}
      return next
    })
  }, [])

  return { theme, isDark: theme === DARK, toggleTheme }
}
