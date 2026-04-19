import { useState, useCallback } from 'react'

const STORAGE_KEY = 'tml-teaching-progress'
const STATES = ['not-started', 'in-progress', 'completed']

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

export function useProgress() {
  const [progress, setProgress] = useState(loadProgress)

  const setTopicState = useCallback((topicId, state) => {
    setProgress(prev => {
      const next = { ...prev, [topicId]: state }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const cycleState = useCallback((topicId) => {
    setProgress(prev => {
      const current = prev[topicId] || 'not-started'
      const next = STATES[(STATES.indexOf(current) + 1) % STATES.length]
      const updated = { ...prev, [topicId]: next }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const completedCount = Object.values(progress).filter(s => s === 'completed').length

  return { progress, setTopicState, cycleState, completedCount }
}
