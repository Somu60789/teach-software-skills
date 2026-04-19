import React from 'react'
import { Box, Grid, Typography, Toolbar } from '@mui/material'
import TopicCard from 'src/components/TopicCard'
import ProgressBar from 'src/components/ProgressBar'
import { TOPICS } from 'src/constants/curriculum'

export default function Home({ progress, completedCount }) {
  return (
    <Box component="main" sx={{ flexGrow: 1, p: 4 }}>
      <Toolbar />
      <Typography variant="h4" fontWeight={700} gutterBottom>Curriculum</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        24 skill domains — from zero to expert. Work through them in order, or jump to any topic.
      </Typography>
      <ProgressBar completedCount={completedCount} />
      <Grid container spacing={2}>
        {TOPICS.map(topic => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={topic.id}>
            <TopicCard topic={topic} state={progress[topic.id] || 'not-started'} />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
