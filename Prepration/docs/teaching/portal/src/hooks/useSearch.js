import { useState, useEffect, useRef, useCallback } from 'react'
import Fuse from 'fuse.js'
import { TOPICS } from 'src/constants/curriculum'

export function useSearch() {
  const fuseRef = useRef(null)
  const [results, setResults] = useState([])

  useEffect(() => {
    async function buildIndex() {
      const docs = await Promise.all(
        TOPICS.map(async topic => {
          const res = await fetch(`/${topic.file}`)
          const text = await res.text()
          const lines = text.split('\n').filter(l => l.trim())
          return lines.map(line => ({ topicId: topic.id, title: topic.title, line }))
        })
      )
      const flat = docs.flat()
      fuseRef.current = new Fuse(flat, {
        keys: ['line', 'title'],
        threshold: 0.3,
        includeMatches: true,
      })
    }
    buildIndex()
  }, [])

  const search = useCallback((query) => {
    if (!query.trim() || !fuseRef.current) { setResults([]); return }
    const raw = fuseRef.current.search(query, { limit: 20 })
    const seen = new Set()
    const deduped = raw.filter(r => {
      if (seen.has(r.item.topicId)) return false
      seen.add(r.item.topicId)
      return true
    })
    setResults(deduped.map(r => ({ topicId: r.item.topicId, title: r.item.title, snippet: r.item.line })))
  }, [])

  return { search, results }
}
