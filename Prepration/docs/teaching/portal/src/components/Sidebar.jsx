import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Drawer, List, ListItemButton, ListItemText, ListItemIcon,
  Typography, Box, Toolbar
} from '@mui/material'
import CircleIcon from '@mui/icons-material/Circle'
import { TOPICS } from 'src/constants/curriculum'

const DRAWER_WIDTH = 280

const STATUS_COLORS = {
  'completed': 'success.main',
  'in-progress': 'warning.main',
  'not-started': 'action.disabled',
}

export default function Sidebar({ progress }) {
  const navigate = useNavigate()
  const { id } = useParams()

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
      }}
    >
      <Toolbar />
      <Box sx={{ overflow: 'auto', py: 1 }}>
        <List dense>
          {TOPICS.map(topic => {
            const state = progress[topic.id] || 'not-started'
            const isActive = id === topic.id
            return (
              <ListItemButton
                key={topic.id}
                selected={isActive}
                onClick={() => navigate(`/topic/${topic.id}`)}
                sx={{ borderRadius: 1, mx: 1, mb: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <CircleIcon sx={{ fontSize: 12, color: STATUS_COLORS[state] }} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body2" noWrap>
                      {topic.id}. {topic.title}
                    </Typography>
                  }
                />
              </ListItemButton>
            )
          })}
        </List>
      </Box>
    </Drawer>
  )
}
