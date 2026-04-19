import React from 'react'
import { Box, Typography, LinearProgress } from '@mui/material'
import { TOPICS } from 'src/constants/curriculum'

export default function ProgressBar({ completedCount }) {
  const total = TOPICS.length
  const pct = Math.round((completedCount / total) * 100)
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" fontWeight={600}>Overall Progress</Typography>
        <Typography variant="body2" color="text.secondary">{completedCount} / {total} completed</Typography>
      </Box>
      <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4 }} />
    </Box>
  )
}
