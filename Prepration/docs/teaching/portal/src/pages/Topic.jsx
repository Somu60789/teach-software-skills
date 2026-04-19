import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Button, Chip, Stack, Toolbar, Typography, Divider } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import Sidebar from 'src/components/Sidebar'
import DocViewer from 'src/components/DocViewer'
import { TOPICS, TOPIC_MAP } from 'src/constants/curriculum'

const STATE_LABELS = { 'not-started': 'Mark In Progress', 'in-progress': 'Mark Completed', 'completed': 'Mark Not Started' }

export default function Topic({ progress, cycleState }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const topic = TOPIC_MAP[id]
  const currentIndex = TOPICS.findIndex(t => t.id === id)
  const prev = TOPICS[currentIndex - 1]
  const next = TOPICS[currentIndex + 1]
  const state = progress[id] || 'not-started'

  if (!topic) return <Typography sx={{ m: 4 }}>Topic not found.</Typography>

  return (
    <Box sx={{ display: 'flex' }}>
      <Sidebar progress={progress} />
      <Box component="main" sx={{ flexGrow: 1, minHeight: '100vh' }}>
        <Toolbar />
        <Box sx={{ px: { xs: 2, md: 4 }, pt: 3, maxWidth: 960, mx: 'auto' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Chip label={`#${topic.id}`} size="small" sx={{ mr: 1 }} />
              <Chip label={topic.difficulty} size="small" color="primary" variant="outlined" sx={{ mr: 1 }} />
              <Chip label={topic.readTime} size="small" variant="outlined" />
            </Box>
            <Button
              size="small"
              variant={state === 'completed' ? 'contained' : 'outlined'}
              color={state === 'completed' ? 'success' : 'primary'}
              startIcon={state === 'completed' ? <CheckCircleIcon /> : null}
              onClick={() => cycleState(id)}
            >
              {STATE_LABELS[state]}
            </Button>
          </Stack>

          <DocViewer file={topic.file} />

          <Divider sx={{ my: 4 }} />

          <Stack direction="row" justifyContent="space-between" sx={{ mb: 4 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => prev && navigate(`/topic/${prev.id}`)}
              disabled={!prev}
            >
              {prev ? prev.title : ''}
            </Button>
            <Button
              endIcon={<ArrowForwardIcon />}
              onClick={() => next && navigate(`/topic/${next.id}`)}
              disabled={!next}
            >
              {next ? next.title : ''}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
