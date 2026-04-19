import React, { useState, useEffect, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import { lightTheme, darkTheme } from 'src/theme'
import Navbar from 'src/components/Navbar'
import SearchBar from 'src/components/SearchBar'
import Home from 'src/pages/Home'
import Topic from 'src/pages/Topic'
import { useProgress } from 'src/hooks/useProgress'

export default function App() {
  const [mode, setMode] = useState(() => localStorage.getItem('tml-theme') || 'light')
  const [searchOpen, setSearchOpen] = useState(false)
  const { progress, cycleState, completedCount } = useProgress()

  const toggleMode = useCallback(() => {
    setMode(m => {
      const next = m === 'light' ? 'dark' : 'light'
      localStorage.setItem('tml-theme', next)
      return next
    })
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <ThemeProvider theme={mode === 'dark' ? darkTheme : lightTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar mode={mode} onToggleMode={toggleMode} onOpenSearch={() => setSearchOpen(true)} />
        <SearchBar open={searchOpen} onClose={() => setSearchOpen(false)} />
        <Routes>
          <Route path="/" element={<Home progress={progress} completedCount={completedCount} />} />
          <Route path="/topic/:id" element={<Topic progress={progress} cycleState={cycleState} />} />
        </Routes>
      </Box>
    </ThemeProvider>
  )
}
