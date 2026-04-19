import React from 'react'
import { AppBar, Toolbar, Typography, IconButton, Tooltip, Box } from '@mui/material'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import SearchIcon from '@mui/icons-material/Search'

export default function Navbar({ mode, onToggleMode, onOpenSearch }) {
  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <Typography variant="h6" noWrap sx={{ flexGrow: 1, fontWeight: 700 }}>
          TML Teaching Portal
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Search (Ctrl+K)">
            <IconButton color="inherit" onClick={onOpenSearch}>
              <SearchIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton color="inherit" onClick={onToggleMode}>
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  )
}
