import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog, DialogContent, TextField, List, ListItemButton,
  ListItemText, Typography, Box
} from '@mui/material'
import { useSearch } from 'src/hooks/useSearch'

export default function SearchBar({ open, onClose }) {
  const [query, setQuery] = useState('')
  const { search, results } = useSearch()
  const navigate = useNavigate()

  useEffect(() => { search(query) }, [query, search])
  useEffect(() => { if (!open) setQuery('') }, [open])

  function handleSelect(topicId) {
    navigate(`/topic/${topicId}`)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogContent sx={{ p: 2 }}>
        <TextField
          autoFocus
          fullWidth
          placeholder="Search topics and content..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          variant="outlined"
          size="small"
        />
        {results.length > 0 && (
          <List sx={{ mt: 1 }}>
            {results.map((r, i) => (
              <ListItemButton key={i} onClick={() => handleSelect(r.topicId)} sx={{ borderRadius: 1 }}>
                <ListItemText
                  primary={<Typography variant="body2" fontWeight={600}>{r.title}</Typography>}
                  secondary={<Typography variant="caption" noWrap>{r.snippet}</Typography>}
                />
              </ListItemButton>
            ))}
          </List>
        )}
        {query && results.length === 0 && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No results for "{query}"</Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
