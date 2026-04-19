import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardActionArea, Typography, Chip, Box } from '@mui/material'
import CircleIcon from '@mui/icons-material/Circle'
import { TOPIC_MAP } from 'src/constants/curriculum'

const STATUS_COLORS = { 'completed': 'success', 'in-progress': 'warning', 'not-started': 'default' }
const STATUS_LABELS = { 'completed': 'Completed', 'in-progress': 'In Progress', 'not-started': 'Not Started' }

export default function TopicCard({ topic, state }) {
  const navigate = useNavigate()
  const prereqTitles = topic.prereqs.map(id => TOPIC_MAP[id]?.title).filter(Boolean)

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardActionArea onClick={() => navigate(`/topic/${topic.id}`)} sx={{ height: '100%', display: 'flex', alignItems: 'flex-start' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">#{topic.id}</Typography>
            <CircleIcon sx={{ fontSize: 10, color: state === 'completed' ? 'success.main' : state === 'in-progress' ? 'warning.main' : 'action.disabled' }} />
          </Box>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>{topic.title}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
            <Chip label={topic.difficulty} size="small" color="primary" variant="outlined" />
            <Chip label={topic.readTime} size="small" variant="outlined" />
          </Box>
          <Chip label={STATUS_LABELS[state]} size="small" color={STATUS_COLORS[state]} />
          {prereqTitles.length > 0 && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Prereqs: {prereqTitles.join(', ')}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  )
}
