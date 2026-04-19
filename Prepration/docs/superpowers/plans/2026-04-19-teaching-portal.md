# TML Teaching Portal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dual-format teaching resource — 24 expert-level Markdown files and a React 18 + Vite + MUI v5 web portal that renders them — covering every skill domain in the TML Enterprise Platform stack.

**Architecture:** The portal is a fully static React SPA. At runtime it fetches raw MD files from `docs/teaching/md/` (served as Vite static assets) and renders them with `react-markdown`. Progress is stored in `localStorage`. Search is client-side via `fuse.js` indexing all 24 files at app load. No backend required.

**Tech Stack:** React 18, Vite 5, MUI v5, React Router v6, react-markdown, remark-gfm, react-syntax-highlighter, fuse.js, localStorage

---

## File Map

### Portal (`docs/teaching/portal/`)
| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies |
| `vite.config.js` | Vite config, static asset path alias |
| `src/main.jsx` | App entry, ThemeProvider, Router |
| `src/App.jsx` | Route definitions |
| `src/theme.js` | MUI light/dark theme definitions |
| `src/constants/curriculum.js` | All 24 topic metadata (id, title, file, prereqs, difficulty, readTime) |
| `src/hooks/useProgress.js` | localStorage read/write for topic states |
| `src/hooks/useSearch.js` | fuse.js index build + search query |
| `src/components/Sidebar.jsx` | Topic list, status dots, active highlight, collapse |
| `src/components/DocViewer.jsx` | Fetch MD file, react-markdown render, syntax highlight, copy button |
| `src/components/SearchBar.jsx` | Ctrl+K modal, fuse.js query, result list |
| `src/components/ProgressBar.jsx` | Overall X/24 completion + MUI LinearProgress |
| `src/components/TopicCard.jsx` | Single topic card for Home grid |
| `src/components/Navbar.jsx` | Top bar, dark/light toggle, search trigger |
| `src/pages/Home.jsx` | Curriculum map grid of TopicCards |
| `src/pages/Topic.jsx` | Sidebar + DocViewer layout, Prev/Next nav, mark-done buttons |

### Teaching Docs (`docs/teaching/md/`)
24 files: `01-react.md` through `24-shared-patterns.md`

---

## Task 1: Scaffold the Portal

**Files:**
- Create: `docs/teaching/portal/package.json`
- Create: `docs/teaching/portal/vite.config.js`
- Create: `docs/teaching/portal/index.html`
- Create: `docs/teaching/portal/src/main.jsx`

- [ ] **Step 1: Create the portal directory and package.json**

```bash
mkdir -p /home/somasekhar/Desktop/TML_Repos/docs/teaching/portal/src/components
mkdir -p /home/somasekhar/Desktop/TML_Repos/docs/teaching/portal/src/pages
mkdir -p /home/somasekhar/Desktop/TML_Repos/docs/teaching/portal/src/hooks
mkdir -p /home/somasekhar/Desktop/TML_Repos/docs/teaching/portal/src/constants
mkdir -p /home/somasekhar/Desktop/TML_Repos/docs/teaching/md
```

Write `docs/teaching/portal/package.json`:
```json
{
  "name": "tml-teaching-portal",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@emotion/react": "^11.13.0",
    "@emotion/styled": "^11.13.0",
    "@mui/icons-material": "^5.16.0",
    "@mui/material": "^5.16.0",
    "fuse.js": "^7.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^9.0.1",
    "react-router-dom": "^6.26.0",
    "react-syntax-highlighter": "^15.5.0",
    "remark-gfm": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Write vite.config.js**

Write `docs/teaching/portal/vite.config.js`:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      src: resolve(__dirname, 'src'),
    },
  },
  // Serve the md folder as static assets
  publicDir: resolve(__dirname, '../md'),
})
```

- [ ] **Step 3: Write index.html**

Write `docs/teaching/portal/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TML Teaching Portal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Write src/main.jsx**

Write `docs/teaching/portal/src/main.jsx`:
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] **Step 5: Install dependencies and verify dev server starts**

```bash
cd /home/somasekhar/Desktop/TML_Repos/docs/teaching/portal
npm install
npm run dev
```
Expected: Vite dev server starts at `http://localhost:5173` with no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/somasekhar/Desktop/TML_Repos
git add docs/teaching/portal/
git commit -m "feat: scaffold teaching portal with Vite + React 18"
```

---

## Task 2: Theme, Curriculum Data, and Hooks

**Files:**
- Create: `docs/teaching/portal/src/theme.js`
- Create: `docs/teaching/portal/src/constants/curriculum.js`
- Create: `docs/teaching/portal/src/hooks/useProgress.js`
- Create: `docs/teaching/portal/src/hooks/useSearch.js`

- [ ] **Step 1: Write src/theme.js**

Write `docs/teaching/portal/src/theme.js`:
```js
import { createTheme } from '@mui/material/styles'

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1565c0' },
    secondary: { main: '#e65100' },
    background: { default: '#f5f5f5', paper: '#ffffff' },
  },
  typography: { fontFamily: '"Inter", "Roboto", sans-serif' },
})

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#90caf9' },
    secondary: { main: '#ffb74d' },
    background: { default: '#121212', paper: '#1e1e1e' },
  },
  typography: { fontFamily: '"Inter", "Roboto", sans-serif' },
})
```

- [ ] **Step 2: Write src/constants/curriculum.js**

Write `docs/teaching/portal/src/constants/curriculum.js`:
```js
export const TOPICS = [
  { id: '01', slug: 'react', title: 'React', file: '01-react.md', prereqs: [], difficulty: 'Beginner→Expert', readTime: '45 min' },
  { id: '02', slug: 'spring-boot', title: 'Spring Boot (Java)', file: '02-spring-boot.md', prereqs: [], difficulty: 'Beginner→Expert', readTime: '60 min' },
  { id: '03', slug: 'kotlin', title: 'Kotlin', file: '03-kotlin.md', prereqs: ['02'], difficulty: 'Intermediate→Expert', readTime: '45 min' },
  { id: '04', slug: 'python-django', title: 'Python & Django', file: '04-python-django.md', prereqs: [], difficulty: 'Beginner→Expert', readTime: '50 min' },
  { id: '05', slug: 'nodejs', title: 'Node.js', file: '05-nodejs.md', prereqs: [], difficulty: 'Beginner→Advanced', readTime: '35 min' },
  { id: '06', slug: 'android', title: 'Android (Jetpack Compose)', file: '06-android.md', prereqs: ['03'], difficulty: 'Intermediate→Expert', readTime: '55 min' },
  { id: '07', slug: 'tauri-rust', title: 'Tauri & Rust', file: '07-tauri-rust.md', prereqs: ['01'], difficulty: 'Intermediate→Advanced', readTime: '40 min' },
  { id: '08', slug: 'postgresql', title: 'PostgreSQL', file: '08-postgresql.md', prereqs: [], difficulty: 'Beginner→Expert', readTime: '50 min' },
  { id: '09', slug: 'kafka', title: 'Apache Kafka', file: '09-kafka.md', prereqs: ['08'], difficulty: 'Intermediate→Expert', readTime: '55 min' },
  { id: '10', slug: 'authentication', title: 'Authentication & Keycloak', file: '10-authentication-keycloak.md', prereqs: ['01', '02'], difficulty: 'Intermediate→Expert', readTime: '50 min' },
  { id: '11', slug: 'aws', title: 'AWS Cloud Services', file: '11-aws.md', prereqs: [], difficulty: 'Beginner→Advanced', readTime: '45 min' },
  { id: '12', slug: 'docker', title: 'Docker', file: '12-docker.md', prereqs: [], difficulty: 'Beginner→Advanced', readTime: '40 min' },
  { id: '13', slug: 'kubernetes-helm', title: 'Kubernetes & Helm', file: '13-kubernetes-helm.md', prereqs: ['12'], difficulty: 'Intermediate→Expert', readTime: '55 min' },
  { id: '14', slug: 'terraform', title: 'Terraform', file: '14-terraform.md', prereqs: ['11', '13'], difficulty: 'Intermediate→Expert', readTime: '50 min' },
  { id: '15', slug: 'github-actions', title: 'GitHub Actions', file: '15-github-actions.md', prereqs: ['12'], difficulty: 'Beginner→Advanced', readTime: '40 min' },
  { id: '16', slug: 'jenkins', title: 'Jenkins', file: '16-jenkins.md', prereqs: ['12'], difficulty: 'Intermediate→Advanced', readTime: '40 min' },
  { id: '17', slug: 'argocd', title: 'ArgoCD', file: '17-argocd.md', prereqs: ['13'], difficulty: 'Intermediate→Advanced', readTime: '35 min' },
  { id: '18', slug: 'ansible', title: 'Ansible', file: '18-ansible.md', prereqs: [], difficulty: 'Beginner→Advanced', readTime: '40 min' },
  { id: '19', slug: 'observability', title: 'Observability & Monitoring', file: '19-observability.md', prereqs: ['13'], difficulty: 'Intermediate→Advanced', readTime: '45 min' },
  { id: '20', slug: 'testing', title: 'Testing', file: '20-testing.md', prereqs: ['01', '02'], difficulty: 'Beginner→Expert', readTime: '50 min' },
  { id: '21', slug: 'code-quality', title: 'Code Quality & Linting', file: '21-code-quality.md', prereqs: ['01', '02'], difficulty: 'Beginner→Intermediate', readTime: '30 min' },
  { id: '22', slug: 'data-export', title: 'Data Export & File Processing', file: '22-data-export.md', prereqs: ['01', '02'], difficulty: 'Beginner→Intermediate', readTime: '30 min' },
  { id: '23', slug: 'external-integrations', title: 'External Integrations', file: '23-external-integrations.md', prereqs: ['02', '09'], difficulty: 'Advanced→Expert', readTime: '45 min' },
  { id: '24', slug: 'shared-patterns', title: 'Shared Patterns & Conventions', file: '24-shared-patterns.md', prereqs: [], difficulty: 'Expert', readTime: '35 min' },
]

export const TOPIC_MAP = Object.fromEntries(TOPICS.map(t => [t.id, t]))
```

- [ ] **Step 3: Write src/hooks/useProgress.js**

Write `docs/teaching/portal/src/hooks/useProgress.js`:
```js
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
```

- [ ] **Step 4: Write src/hooks/useSearch.js**

Write `docs/teaching/portal/src/hooks/useSearch.js`:
```js
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
          // Split into lines and pair with topic for result snippets
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
    // Deduplicate by topicId — show first matching line per topic
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
```

- [ ] **Step 5: Commit**

```bash
cd /home/somasekhar/Desktop/TML_Repos
git add docs/teaching/portal/src/
git commit -m "feat: add theme, curriculum data, progress and search hooks"
```

---

## Task 3: Navbar and Sidebar Components

**Files:**
- Create: `docs/teaching/portal/src/components/Navbar.jsx`
- Create: `docs/teaching/portal/src/components/Sidebar.jsx`
- Create: `docs/teaching/portal/src/components/SearchBar.jsx`

- [ ] **Step 1: Write Navbar.jsx**

Write `docs/teaching/portal/src/components/Navbar.jsx`:
```jsx
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
```

- [ ] **Step 2: Write Sidebar.jsx**

Write `docs/teaching/portal/src/components/Sidebar.jsx`:
```jsx
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
```

- [ ] **Step 3: Write SearchBar.jsx**

Write `docs/teaching/portal/src/components/SearchBar.jsx`:
```jsx
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
```

- [ ] **Step 4: Commit**

```bash
cd /home/somasekhar/Desktop/TML_Repos
git add docs/teaching/portal/src/components/Navbar.jsx \
        docs/teaching/portal/src/components/Sidebar.jsx \
        docs/teaching/portal/src/components/SearchBar.jsx
git commit -m "feat: add Navbar, Sidebar, SearchBar components"
```

---

## Task 4: DocViewer and ProgressBar Components

**Files:**
- Create: `docs/teaching/portal/src/components/DocViewer.jsx`
- Create: `docs/teaching/portal/src/components/ProgressBar.jsx`
- Create: `docs/teaching/portal/src/components/TopicCard.jsx`

- [ ] **Step 1: Write DocViewer.jsx**

Write `docs/teaching/portal/src/components/DocViewer.jsx`:
```jsx
import React, { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Box, IconButton, Tooltip, CircularProgress, Typography } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'

function CopyButton({ code }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Tooltip title={copied ? 'Copied!' : 'Copy'}>
      <IconButton size="small" onClick={handleCopy} sx={{ position: 'absolute', top: 8, right: 8, color: 'grey.400' }}>
        {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  )
}

const components = {
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    const code = String(children).replace(/\n$/, '')
    if (!inline && match) {
      return (
        <Box sx={{ position: 'relative', my: 2 }}>
          <CopyButton code={code} />
          <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
            {code}
          </SyntaxHighlighter>
        </Box>
      )
    }
    return <code className={className} style={{ background: 'rgba(128,128,128,0.15)', padding: '2px 6px', borderRadius: 4 }} {...props}>{children}</code>
  },
}

export default function DocViewer({ file }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/${file}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load ${file}`)
        return res.text()
      })
      .then(text => { setContent(text); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [file])

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
  if (error) return <Typography color="error" sx={{ mt: 4 }}>{error}</Typography>

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, md: 4 }, py: 4,
      '& h1': { fontSize: '2rem', fontWeight: 700, mb: 2, mt: 0 },
      '& h2': { fontSize: '1.5rem', fontWeight: 600, mb: 1.5, mt: 4, borderBottom: '1px solid', borderColor: 'divider', pb: 0.5 },
      '& h3': { fontSize: '1.2rem', fontWeight: 600, mb: 1, mt: 3 },
      '& p': { lineHeight: 1.8, mb: 1.5 },
      '& table': { borderCollapse: 'collapse', width: '100%', mb: 2 },
      '& th, & td': { border: '1px solid', borderColor: 'divider', p: 1, textAlign: 'left' },
      '& blockquote': { borderLeft: '4px solid', borderColor: 'primary.main', pl: 2, my: 2, color: 'text.secondary' },
      '& a': { color: 'primary.main' },
      '& ul, & ol': { pl: 3, mb: 1.5 },
      '& li': { mb: 0.5 },
    }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </Box>
  )
}
```

- [ ] **Step 2: Write ProgressBar.jsx**

Write `docs/teaching/portal/src/components/ProgressBar.jsx`:
```jsx
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
```

- [ ] **Step 3: Write TopicCard.jsx**

Write `docs/teaching/portal/src/components/TopicCard.jsx`:
```jsx
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
      <CardActionArea onClick={() => navigate(`/topic/${topic.id}`)} sx={{ height: '100%', alignItems: 'flex-start' }}>
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
```

- [ ] **Step 4: Commit**

```bash
cd /home/somasekhar/Desktop/TML_Repos
git add docs/teaching/portal/src/components/
git commit -m "feat: add DocViewer, ProgressBar, TopicCard components"
```

---

## Task 5: Pages, App, and Keyboard Shortcut Wiring

**Files:**
- Create: `docs/teaching/portal/src/pages/Home.jsx`
- Create: `docs/teaching/portal/src/pages/Topic.jsx`
- Create: `docs/teaching/portal/src/App.jsx`

- [ ] **Step 1: Write Home.jsx**

Write `docs/teaching/portal/src/pages/Home.jsx`:
```jsx
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
```

- [ ] **Step 2: Write Topic.jsx**

Write `docs/teaching/portal/src/pages/Topic.jsx`:
```jsx
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
              onClick={() => navigate(`/topic/${prev.id}`)}
              disabled={!prev}
            >
              {prev ? prev.title : ''}
            </Button>
            <Button
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate(`/topic/${next.id}`)}
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
```

- [ ] **Step 3: Write App.jsx**

Write `docs/teaching/portal/src/App.jsx`:
```jsx
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
```

- [ ] **Step 4: Verify portal runs end-to-end**

```bash
cd /home/somasekhar/Desktop/TML_Repos/docs/teaching/portal
npm run dev
```

Open `http://localhost:5173` — should show Home page with 24 topic cards (they will show loading state since MD files don't exist yet — that is expected).

Navigate to `http://localhost:5173/topic/01` — should show a loading spinner or "Failed to load" message. That confirms routing works.

Press `Ctrl+K` — search modal should open.

- [ ] **Step 5: Commit**

```bash
cd /home/somasekhar/Desktop/TML_Repos
git add docs/teaching/portal/src/
git commit -m "feat: complete portal — pages, routing, theme, keyboard shortcut"
```

---

## Task 6: Create MD File Stubs (All 24 Topics)

**Files:** Create all 24 stubs in `docs/teaching/md/`

This task creates placeholder MD files with the correct template headings. The actual expert content is written in Tasks 7–30 (one task per doc).

- [ ] **Step 1: Write the stub template script**

Run this to create all 24 stub files at once:

```bash
cd /home/somasekhar/Desktop/TML_Repos/docs/teaching/md

for item in \
  "01-react.md|React" \
  "02-spring-boot.md|Spring Boot (Java)" \
  "03-kotlin.md|Kotlin" \
  "04-python-django.md|Python & Django" \
  "05-nodejs.md|Node.js" \
  "06-android.md|Android (Jetpack Compose)" \
  "07-tauri-rust.md|Tauri & Rust" \
  "08-postgresql.md|PostgreSQL" \
  "09-kafka.md|Apache Kafka" \
  "10-authentication-keycloak.md|Authentication & Keycloak" \
  "11-aws.md|AWS Cloud Services" \
  "12-docker.md|Docker" \
  "13-kubernetes-helm.md|Kubernetes & Helm" \
  "14-terraform.md|Terraform" \
  "15-github-actions.md|GitHub Actions" \
  "16-jenkins.md|Jenkins" \
  "17-argocd.md|ArgoCD" \
  "18-ansible.md|Ansible" \
  "19-observability.md|Observability & Monitoring" \
  "20-testing.md|Testing" \
  "21-code-quality.md|Code Quality & Linting" \
  "22-data-export.md|Data Export & File Processing" \
  "23-external-integrations.md|External Integrations (SAP, IoT, Freight Tiger)" \
  "24-shared-patterns.md|Shared Patterns & Conventions"
do
  file="${item%%|*}"
  title="${item##*|}"
  cat > "$file" << MDEOF
# ${title}

## Prerequisites

> List what the reader should know before starting this doc.

## What & Why

> What is this technology? What problem does it solve? Why does TML use it?

## Core Concepts

> Fundamental building blocks, one at a time.

## Installation & Setup

> Step-by-step: install, configure, run a hello world.

## Beginner

> First real patterns with working generic code examples.

## Intermediate

> More complex patterns, configuration, real-world scenarios.

## Advanced

> Edge cases, performance tuning, architecture decisions.

## Expert

> Internals, production debugging, things learned from incidents.

## In the TML Codebase

> Where this skill appears in the repos, TML-specific patterns, real code snippets.

## Quick Reference

> Cheat sheet of most-used commands and patterns.
MDEOF
done
```

- [ ] **Step 2: Verify stubs exist**

```bash
ls /home/somasekhar/Desktop/TML_Repos/docs/teaching/md/
```
Expected: 24 `.md` files listed.

- [ ] **Step 3: Verify portal loads a stub**

Open `http://localhost:5173/topic/01` — should now render the stub headings for React instead of an error.

- [ ] **Step 4: Commit**

```bash
cd /home/somasekhar/Desktop/TML_Repos
git add docs/teaching/md/
git commit -m "feat: add 24 teaching doc stubs with section template"
```

---

## Tasks 7–30: Write the 24 Teaching Docs

Each task below follows the same pattern. Every doc must follow the 10-section template exactly. Each section must contain real content — no "TBD" or "add content here". Generic examples use neutral entities (User, Product, Order, Todo). TML-specific section cites real file paths and project names from SKILLS_REQUIRED.md.

---

### Task 7: Write 01-react.md

**File:** `docs/teaching/md/01-react.md`

- [ ] Write the full document covering:
  - **Prerequisites:** Basic HTML, CSS, JavaScript (ES6+)
  - **What & Why:** Declarative UI, component model, virtual DOM, why TML chose React over Vue/Angular
  - **Core Concepts:** JSX, components, props, state, hooks lifecycle
  - **Installation & Setup:** `npm create vite@latest`, project structure, `npm run dev`
  - **Beginner:** `useState`, `useEffect`, props drilling, event handlers, conditional rendering, lists with `.map()` and `key`
  - **Intermediate:** Custom hooks, `useCallback`, `useMemo`, `useRef`, `useContext`, React Router v6 (`BrowserRouter`, `Routes`, `Route`, `useParams`, `useNavigate`), lazy loading with `React.lazy()` + `Suspense`
  - **Advanced:** Performance optimisation (`React.memo`, `useMemo`), `react-virtuoso` for large lists, `react-beautiful-dnd` drag-and-drop, WebSocket integration with `useEffect` cleanup
  - **Expert:** Reconciliation algorithm, fiber architecture, concurrent features (`useTransition`, `useDeferredValue`), profiling with React DevTools
  - **In the TML Codebase:** Vite alias (`src/` → `src/`), shared Axios wrapper in `src/constants/commonUtils.jsx`, Recoil atoms in `src/recoil/`, route constants in `src/constants/constants.jsx`, MUI theming pattern, `avant-garde-components-library` usage
  - **Quick Reference:** Hook cheat sheet, Router v6 patterns, common pitfalls

- [ ] Commit:
```bash
cd /home/somasekhar/Desktop/TML_Repos
git add docs/teaching/md/01-react.md
git commit -m "docs: write React teaching doc (01)"
```

---

### Task 8: Write 02-spring-boot.md

**File:** `docs/teaching/md/02-spring-boot.md`

- [ ] Write the full document covering:
  - **Prerequisites:** Java basics (OOP, generics, lambdas, streams)
  - **What & Why:** Convention over configuration, embedded server, Spring ecosystem, why TML uses it over Quarkus/Micronaut
  - **Core Concepts:** Auto-configuration, component scanning, dependency injection (`@Autowired`, constructor injection), application context
  - **Installation & Setup:** Spring Initializr, Gradle wrapper, `./gradlew bootRun`, project structure (`controller/service/repository/entity/dto/config`)
  - **Beginner:** `@RestController`, `@GetMapping`/`@PostMapping`, `@PathVariable`, `@RequestParam`, `@RequestBody`, `ResponseEntity`, `@Service`, `@Repository`, `@Component`
  - **Intermediate:** `@Transactional`, `@Async`, `@Scheduled`, `@ConfigurationProperties`, `@Value`, multi-profile `application.yaml`, Spring Data JPA (`JpaRepository`, `@Query`, Specifications), Flyway migrations, `@ControllerAdvice` global exception handling
  - **Advanced:** Spring Security stateless JWT, `@PreAuthorize`, custom filters, Actuator endpoints, Micrometer Prometheus metrics, SpringDoc OpenAPI, `@EventListener`, `ApplicationEventPublisher`
  - **Expert:** Auto-configuration internals (`@Conditional`), Spring Boot startup optimisation, GraalVM native image considerations, debugging slow context startup
  - **In the TML Codebase:** Jetty vs Tomcat (TML uses Jetty explicitly), `./setup.sh` pre-commit hook, Spotless formatting, H2 test config, `docker-compose-tools.yml`, BU segmentation in `application.yaml`, feature toggles pattern, archive repository pattern
  - **Quick Reference:** Gradle commands, common annotations, YAML config structure

- [ ] Commit:
```bash
git add docs/teaching/md/02-spring-boot.md
git commit -m "docs: write Spring Boot teaching doc (02)"
```

---

### Task 9: Write 03-kotlin.md

**File:** `docs/teaching/md/03-kotlin.md`

- [ ] Write the full document covering:
  - **Prerequisites:** Java (Tasks 7 completed), basic OOP
  - **What & Why:** Concise syntax, null safety, data classes, interop with Java, why TML uses Kotlin for repositories
  - **Core Concepts:** Null safety (`?`, `!!`, `?.`, `?:`), data classes, extension functions, lambdas, `when` expressions
  - **Installation & Setup:** IntelliJ IDEA, Kotlin plugin in Gradle (`build.gradle.kts`), mixed Java/Kotlin project
  - **Beginner:** Data classes as DTOs, `val`/`var`, string templates, `when`, `if` as expression, named/default parameters
  - **Intermediate:** Extension functions, higher-order functions, `let`/`run`/`also`/`apply`/`with`, collections API (filter, map, groupBy, associate), Kotlin Spring Data repositories
  - **Advanced:** Coroutines (`suspend`, `async`/`await`, `Flow`), Exposed ORM (Table DSL, transaction blocks), Arrow-kt (`Either<L,R>`, `Option<A>`, `Try`)
  - **Expert:** Kotlin compiler plugins, inline functions and reified type parameters, DSL building, Kotest spec styles, MockK coroutine support (`coEvery`, `coVerify`)
  - **In the TML Codebase:** Kotlin used exclusively for JPA repositories in `ep-production-broadcast`, `ep-prolife-service`; Arrow-kt error handling replacing try/catch; `ep-reconciliation` uses Exposed ORM; Kotest in `ep-replenishment`
  - **Quick Reference:** Extension function patterns, Arrow-kt Either chaining, Kotest assertion styles

- [ ] Commit:
```bash
git add docs/teaching/md/03-kotlin.md
git commit -m "docs: write Kotlin teaching doc (03)"
```

---

### Task 10: Write 04-python-django.md

**File:** `docs/teaching/md/04-python-django.md`

- [ ] Write the full document covering:
  - **Prerequisites:** Python basics (functions, classes, list comprehensions, decorators)
  - **What & Why:** Batteries-included web framework, ORM, DRF for REST APIs, why TML uses it for data-heavy Python services
  - **Core Concepts:** MVT pattern, ORM, migrations, URL routing, views, serializers
  - **Installation & Setup:** `python -m venv venv`, `pip install django djangorestframework`, `django-admin startproject`, `manage.py runserver`
  - **Beginner:** Models, migrations (`makemigrations`, `migrate`), `ModelSerializer`, `ViewSet`, `APIView`, `@api_view`
  - **Intermediate:** QuerySet API (`filter`, `exclude`, `select_related`, `prefetch_related`, `annotate`, `aggregate`), JWT auth (`rest_framework_simplejwt`), custom permissions, pagination, filtering
  - **Advanced:** Custom management commands, Django signals, celery task integration, `pandas` for data processing inside Django, `openpyxl` for Excel import/export
  - **Expert:** Django internals (request lifecycle, middleware), query optimisation (`EXPLAIN ANALYZE`), connection pooling with pgBouncer, `coverage` for test coverage
  - **In the TML Codebase:** `python-keycloak` for token validation, Kafka producer/consumer in Django views and management commands, `docker-compose` for local PostgreSQL, `XlsxWriter` pattern in pv-sadhan
  - **Quick Reference:** ORM cheat sheet, DRF serializer patterns, common management commands

- [ ] Commit:
```bash
git add docs/teaching/md/04-python-django.md
git commit -m "docs: write Python/Django teaching doc (04)"
```

---

### Task 11: Write 05-nodejs.md

**File:** `docs/teaching/md/05-nodejs.md`

- [ ] Write the full document covering:
  - **Prerequisites:** JavaScript (ES6+), async/await
  - **What & Why:** Non-blocking I/O, event loop, ideal for real-time and lightweight APIs
  - **Core Concepts:** Event loop, `require` vs ES modules, `package.json`, npm lifecycle
  - **Installation & Setup:** `nvm`, Node 20 LTS, `npm init`, Express scaffold
  - **Beginner:** Express router, middleware, `req`/`res`, error-handling middleware, `dotenv`
  - **Intermediate:** WebSockets with `ws` library (server broadcast pattern), `pg` direct PostgreSQL queries, connection pooling, `jsonwebtoken` middleware, `multer` file upload
  - **Advanced:** `exceljs` workbook generation and streaming, CORS configuration, rate limiting, graceful shutdown
  - **Expert:** Node.js cluster mode, memory leak debugging, `--inspect` + Chrome DevTools profiling
  - **In the TML Codebase:** `ep-eloto` architecture — Express REST + WebSocket push for real-time manufacturing data, `pg` connection pool config, JWT auth middleware pattern
  - **Quick Reference:** Express middleware chain, WebSocket event reference, `pg` query patterns

- [ ] Commit:
```bash
git add docs/teaching/md/05-nodejs.md
git commit -m "docs: write Node.js teaching doc (05)"
```

---

### Task 12: Write 06-android.md

**File:** `docs/teaching/md/06-android.md`

- [ ] Write the full document covering:
  - **Prerequisites:** Kotlin (Task 9 completed), basic OOP
  - **What & Why:** Android HHT (handheld terminal) for shop-floor scanning, Jetpack Compose declarative UI
  - **Core Concepts:** Composables, state hoisting, recomposition, `remember`, `LaunchedEffect`
  - **Installation & Setup:** Android Studio, emulator setup, Gradle build, `local.properties`
  - **Beginner:** `@Composable`, `Column`/`Row`/`Box`, `Text`/`Button`/`TextField`, `remember { mutableStateOf() }`, `LaunchedEffect`
  - **Intermediate:** Hilt DI (`@HiltViewModel`, `@Inject`, `@Module`, `@Provides`), ViewModel + StateFlow, navigation with `NavHost`/`NavController`, DataStore Preferences for local persistence
  - **Advanced:** Ktor Client (async HTTP, `kotlinx.serialization`), AppAuth PKCE OAuth2 flow with Keycloak, encrypted DataStore
  - **Expert:** Certificate pinning (`OkHttpClient.Builder().certificatePinner()`), Compose performance (skippable composables, stability), JaCoCo coverage in Android, Espresso and Compose testing
  - **In the TML Codebase:** `ep-prolife-service-hht-ui` — barcode scanning on shop floor, Keycloak OIDC auth, cert pinning for shop-floor network security, MockK + Kotest test suite
  - **Quick Reference:** Compose state patterns, Hilt annotation reference, Ktor request DSL

- [ ] Commit:
```bash
git add docs/teaching/md/06-android.md
git commit -m "docs: write Android teaching doc (06)"
```

---

### Task 13: Write 07-tauri-rust.md

**File:** `docs/teaching/md/07-tauri-rust.md`

- [ ] Write the full document covering:
  - **Prerequisites:** React (Task 7), basic systems programming concepts
  - **What & Why:** Desktop app packaging for Windows/Linux, IPP printer communication, why Tauri over Electron (memory, size)
  - **Core Concepts:** Tauri architecture (Webview + Rust backend), IPC via `invoke`, `#[tauri::command]`
  - **Installation & Setup:** Rust toolchain (`rustup`), Tauri CLI, `npm run tauri dev`
  - **Beginner:** `#[tauri::command]` functions, `invoke('command_name', { arg })` from React, `tauri.conf.json`
  - **Intermediate:** Rust basics for Tauri context — structs, `Result<T,E>`, pattern matching, `tokio` async, `serde` JSON serialisation
  - **Advanced:** IPP protocol communication (label printer integration), file system access via Tauri API, window management, system tray
  - **Expert:** Cross-platform build pipeline (`tauri build`), Windows installer (NSIS), Linux AppImage, code signing
  - **In the TML Codebase:** `ep-prolife-service-ui` — Tauri wraps the React 19 web UI, Rust backend handles label printing via IPP, `src-tauri/Cargo.toml` dependencies
  - **Quick Reference:** Tauri command template, `invoke` call patterns, `tauri build` targets

- [ ] Commit:
```bash
git add docs/teaching/md/07-tauri-rust.md
git commit -m "docs: write Tauri/Rust teaching doc (07)"
```

---

### Task 14: Write 08-postgresql.md

**File:** `docs/teaching/md/08-postgresql.md`

- [ ] Write the full document covering:
  - **Prerequisites:** Basic understanding of data and tables
  - **What & Why:** ACID compliance, JSONB, powerful query planner, AWS RDS managed offering
  - **Core Concepts:** Tables, primary/foreign keys, indexes, transactions, ACID
  - **Installation & Setup:** `docker run postgres:15`, `psql` CLI, pgAdmin, `\dt`, `\d table`
  - **Beginner:** `CREATE TABLE`, `INSERT`, `SELECT`, `WHERE`, `JOIN` (INNER, LEFT, RIGHT), `UPDATE`, `DELETE`, data types
  - **Intermediate:** Composite primary keys, `UNIQUE` constraints, `INDEX` creation, `EXPLAIN ANALYZE`, window functions (`ROW_NUMBER`, `RANK`, `LAG`), CTEs (`WITH`), `UPSERT` (`INSERT ... ON CONFLICT DO UPDATE`)
  - **Advanced:** Table partitioning, connection pooling with HikariCP (Spring Boot config), `LISTEN`/`NOTIFY` for async events, `JSONB` operators (`->`, `->>`, `@>`), full-text search (`tsvector`, `tsquery`)
  - **Expert:** Vacuum and autovacuum tuning, `pg_stat_activity` and query kill, lock contention diagnosis (`pg_locks`), replication concepts, RDS parameter group tuning
  - **In the TML Codebase:** Flyway migration naming (`VYYYYMMDDhhmm__desc.sql`), H2 in tests (`MODE=PostgreSQL`), HikariCP defaults in Spring Boot, archive table pattern (operational → archive), AWS RDS across environments
  - **Quick Reference:** SQL cheat sheet, `EXPLAIN ANALYZE` output reading guide, HikariCP config properties

- [ ] Commit:
```bash
git add docs/teaching/md/08-postgresql.md
git commit -m "docs: write PostgreSQL teaching doc (08)"
```

---

### Task 15: Write 09-kafka.md

**File:** `docs/teaching/md/09-kafka.md`

- [ ] Write the full document covering:
  - **Prerequisites:** PostgreSQL (Task 14), basic messaging concepts
  - **What & Why:** Durable event log, decoupling microservices, replay capability, why Kafka over RabbitMQ
  - **Core Concepts:** Topics, partitions, consumer groups, offsets, brokers, producers, consumers, retention
  - **Installation & Setup:** `docker-compose` with Kafka + Zookeeper, `kafka-topics.sh`, `kafka-console-producer.sh`, `kafka-console-consumer.sh`
  - **Beginner:** Spring `@KafkaListener`, `KafkaTemplate.send()`, consumer group config, `auto.offset.reset=latest`, JSON message serialisation
  - **Intermediate:** Manual commit (`Acknowledgment.acknowledge()`), error handling and retry topics, `@EmbeddedKafka` in tests, `concurrency=1` single-threaded consumer, `max.poll.records=10`
  - **Advanced:** Kafka Streams (topology, `KStream`, `KTable`, `GlobalKTable`, stateful operations with state stores), exactly-once semantics, consumer lag monitoring
  - **Expert:** AMQ Streams (Red Hat Kafka Operator), partition rebalancing, consumer lag alerting with Prometheus, dead letter topic pattern, message ordering guarantees
  - **In the TML Codebase:** Topic naming convention (`{domain}-{entity}-{action}-v{version}`), cross-service topic map (which service produces/consumes what), `ep-sap-connector` Kafka Streams bridge, single-threaded consumer config rationale (ordering guarantee), MDC correlation ID propagation
  - **Quick Reference:** Spring Kafka annotation reference, `KafkaTemplate` send patterns, topic naming template

- [ ] Commit:
```bash
git add docs/teaching/md/09-kafka.md
git commit -m "docs: write Apache Kafka teaching doc (09)"
```

---

### Task 16: Write 10-authentication-keycloak.md

**File:** `docs/teaching/md/10-authentication-keycloak.md`

- [ ] Write the full document covering:
  - **Prerequisites:** React (01), Spring Boot (02), HTTP basics (cookies, headers, tokens)
  - **What & Why:** OAuth2/OIDC centralised auth, SSO across services, Keycloak as self-hosted identity provider
  - **Core Concepts:** OAuth2 flows (Auth Code, Client Credentials, PKCE), JWT structure (header.payload.signature), OIDC ID token vs Access token, Keycloak realms/clients/roles/groups
  - **Installation & Setup:** Keycloak Docker, create realm, create client, configure redirect URIs, export realm JSON
  - **Beginner:** `keycloak-js` React integration (`new Keycloak(config)`, `kc.init()`, `kc.token`), Spring `@PreAuthorize("hasRole('ROLE_ADMIN')")`
  - **Intermediate:** Spring OAuth2 Resource Server config, `SecurityContextFilter` JWT extraction, `JwtUtil` claim parsing, client credentials for service-to-service, `python-keycloak` token introspection
  - **Advanced:** Keycloak Admin Client (create users, assign roles, group membership via API), AppAuth PKCE flow on Android, custom token mappers (add custom claims to JWT)
  - **Expert:** Keycloak clustering and session replication, token refresh strategy, silent SSO, certificate rotation, debugging `401 Unauthorized` systematically
  - **In the TML Codebase:** Keycloak 19 vs 26 split across services, stateless sessions (`STATELESS` policy), `ep-authorization` centralized plant-permission service, `SecurityContextFilter` pattern, `JwtUtil` claim extraction, `preferred_username` and `realm_access.roles` claims used
  - **Quick Reference:** JWT claims reference, Spring Security config skeleton, `keycloak-js` init options

- [ ] Commit:
```bash
git add docs/teaching/md/10-authentication-keycloak.md
git commit -m "docs: write Authentication & Keycloak teaching doc (10)"
```

---

### Task 17: Write 11-aws.md

**File:** `docs/teaching/md/11-aws.md`

- [ ] Write the full document covering:
  - **Prerequisites:** Basic networking (DNS, HTTP, ports)
  - **What & Why:** Cloud infrastructure, managed services, global reach, TML uses `ap-south-1` (Mumbai)
  - **Core Concepts:** Regions, AZs, IAM (users, roles, policies, OIDC), VPC, security groups
  - **Installation & Setup:** AWS CLI (`aws configure`), OIDC auth for GitHub Actions, `aws sts get-caller-identity`
  - **Beginner:** S3 (buckets, `PutObject`, `GetObject`, presigned URLs), SES (verified identities, `SendEmail`), ECR (login, push, pull)
  - **Intermediate:** Secrets Manager (create secret, `GetSecretValue`, rotation), RDS (create instance, connection string, parameter groups), IAM roles for EKS (IRSA), ALB listener rules
  - **Advanced:** IoT Core (MQTT topics, device certificates, policy), AWS SDK Java (`S3Client`, `SesClient`), `boto3` in Python, CloudWatch metrics and alarms
  - **Expert:** Cost optimisation (right-sizing, Reserved Instances), VPC flow logs, GuardDuty, multi-region considerations, AWS Well-Architected review
  - **In the TML Codebase:** ECR image push from GitHub Actions (OIDC — no stored keys), External Secrets Operator syncing Secrets Manager to K8s Secrets, SES for adherence reports (`ap-south-1`), S3 for machine data in `ep-machine-integration`, IoT SDK MQTT subscription
  - **Quick Reference:** AWS CLI command reference, IAM policy skeleton, SDK Java client patterns

- [ ] Commit:
```bash
git add docs/teaching/md/11-aws.md
git commit -m "docs: write AWS teaching doc (11)"
```

---

### Task 18: Write 12-docker.md

**File:** `docs/teaching/md/12-docker.md`

- [ ] Write the full document covering:
  - **Prerequisites:** Basic Linux command line
  - **What & Why:** Reproducible environments, container isolation, portable deployments
  - **Core Concepts:** Image vs container, layers, Dockerfile instructions, registry, tags
  - **Installation & Setup:** Docker Desktop, `docker run hello-world`, basic commands (`ps`, `images`, `logs`, `exec`, `stop`, `rm`)
  - **Beginner:** `FROM`, `COPY`, `RUN`, `CMD`, `EXPOSE`, `ENV`, build and run a simple app container
  - **Intermediate:** Multi-stage builds (build stage → runtime stage), `.dockerignore`, `docker-compose.yml` (services, volumes, networks, depends_on, env_file), health checks
  - **Advanced:** Alpine vs Debian base image tradeoffs, custom base images in ECR, layer caching optimisation, `docker buildx` multi-platform builds, security scanning (`docker scout`)
  - **Expert:** Container runtime internals (namespaces, cgroups), rootless containers, distroless images, `docker stats` and memory limit tuning
  - **In the TML Codebase:** Multi-stage pattern (Gradle build → `ep-openjdk` runtime; Node build → `ep-nginx` with `nginx.conf`), `docker-compose-tools.yml` for PostgreSQL + Kafka + Zookeeper, ECR image naming convention (`<account>.dkr.ecr.ap-south-1.amazonaws.com/<service>:<commit-sha>`), custom TML base images
  - **Quick Reference:** Dockerfile best practices, `docker-compose` command reference, `nginx.conf` SPA template

- [ ] Commit:
```bash
git add docs/teaching/md/12-docker.md
git commit -m "docs: write Docker teaching doc (12)"
```

---

### Task 19: Write 13-kubernetes-helm.md

**File:** `docs/teaching/md/13-kubernetes-helm.md`

- [ ] Write the full document covering:
  - **Prerequisites:** Docker (Task 18)
  - **What & Why:** Container orchestration, self-healing, scaling, declarative config
  - **Core Concepts:** Pod, Deployment, Service, Ingress, ConfigMap, Secret, Namespace, Node
  - **Installation & Setup:** `kubectl` CLI, `kubeconfig`, `kubectl get pods -n <ns>`, `kubectl logs`, `kubectl exec`
  - **Beginner:** Write a Deployment YAML, Service YAML, `kubectl apply -f`, `kubectl rollout status`, `kubectl port-forward`
  - **Intermediate:** HPA (Horizontal Pod Autoscaler), resource requests/limits, liveness/readiness probes (mapping to Spring Boot actuator), CronJobs, `kubectl rollout undo`
  - **Advanced:** External Secrets Operator (ExternalSecret CRD → AWS Secrets Manager → K8s Secret), KOPS cluster management, namespace isolation strategy, RBAC basics
  - **Expert:** etcd backup, cluster upgrade strategy with KOPS, `kubectl top`, OOMKilled diagnosis, PodDisruptionBudgets
  - **Helm:** Chart structure (`Chart.yaml`, `values.yaml`, `templates/`), `helm upgrade --install`, `helm rollback`, `helm history`, `ep-app` generic chart pattern, per-environment values files, Ansible templating of values before helm apply
  - **In the TML Codebase:** KOPS cluster versions (1.24–1.28), namespaces per product-line, External Secrets Operator for AWS Secrets Manager, `ep-app` chart used across all services, `argocd/deploy/{env}/{app}/` structure
  - **Quick Reference:** `kubectl` command reference, Helm command reference, YAML resource templates

- [ ] Commit:
```bash
git add docs/teaching/md/13-kubernetes-helm.md
git commit -m "docs: write Kubernetes & Helm teaching doc (13)"
```

---

### Task 20: Write 14-terraform.md

**File:** `docs/teaching/md/14-terraform.md`

- [ ] Write the full document covering:
  - **Prerequisites:** AWS (Task 17), Kubernetes (Task 19)
  - **What & Why:** Infrastructure as code, repeatable environments, drift detection
  - **Core Concepts:** Provider, resource, data source, variable, output, state, module
  - **Installation & Setup:** `terraform init`, `terraform plan`, `terraform apply`, S3 backend + DynamoDB lock
  - **Beginner:** Write a simple S3 bucket resource, variables, outputs, `terraform.tfvars`
  - **Intermediate:** Modules (reusable, with `source`, variables, outputs), remote state (`terraform_remote_state`), `for_each` and `count`, `depends_on`, workspaces for environment isolation
  - **Advanced:** AWS provider resources (VPC, ALB, RDS, ECR, IAM, Secrets Manager), Kubernetes provider (namespace, service account), Helm provider (helm_release), Keycloak provider (realm, client, roles)
  - **Expert:** `terraform import`, state surgery (`terraform state mv`, `terraform state rm`), provider version pinning, sentinel policies, Atlantis for PR-based plans
  - **In the TML Codebase:** Directory structure `terraform/{module}/{context}/{environment}/`, contexts: ipms4/mes4/mes4-ev, environments: dev/pre-prod/prod, S3 backend config in `backend.tf`, Makefile wrapping terraform commands in `ep-assembly-root`
  - **Quick Reference:** HCL syntax cheat sheet, common AWS resource patterns, module calling template

- [ ] Commit:
```bash
git add docs/teaching/md/14-terraform.md
git commit -m "docs: write Terraform teaching doc (14)"
```

---

### Task 21: Write 15-github-actions.md

**File:** `docs/teaching/md/15-github-actions.md`

- [ ] Write the full document covering:
  - **Prerequisites:** Docker (Task 18), basic Git
  - **What & Why:** CI/CD automation, push-triggered builds, OIDC for cloud auth
  - **Core Concepts:** Workflow, job, step, action, trigger (`on:`), runner, secrets
  - **Installation & Setup:** `.github/workflows/build.yml`, GitHub web UI to view runs, `act` for local testing
  - **Beginner:** `on: push`, `jobs.build.runs-on: ubuntu-latest`, `steps` with `uses` and `run`, `${{ github.sha }}`, caching `node_modules`
  - **Intermediate:** OIDC AWS auth (`aws-actions/configure-aws-credentials@v4`), ECR login (`aws-actions/amazon-ecr-login@v2`), Docker build/push, environment variables and secrets, matrix builds
  - **Advanced:** Reusable workflows (`workflow_call`, `workflow_dispatch`), composite actions, concurrency groups to cancel stale runs, branch protection rules with required checks
  - **Expert:** Self-hosted runners (in Kubernetes via `ep-infrastructure`), OIDC trust policy configuration in AWS IAM, workflow debugging with `tmate`, cost optimisation (cache hits, runner sizing)
  - **In the TML Codebase:** Triggers on `development`/`master`/`pre-prod`, OIDC-based AWS auth (no stored keys), ECR push with commit SHA tag, `ep-github-workflows` reusable workflow repo, infrastructure Terraform apply workflows
  - **Quick Reference:** Workflow YAML skeleton, OIDC AWS block, Docker ECR build/push block

- [ ] Commit:
```bash
git add docs/teaching/md/15-github-actions.md
git commit -m "docs: write GitHub Actions teaching doc (15)"
```

---

### Task 22: Write 16-jenkins.md

**File:** `docs/teaching/md/16-jenkins.md`

- [ ] Write the full document covering:
  - **Prerequisites:** Docker (Task 18), Groovy basics
  - **What & Why:** Legacy CI server, shared library pattern, dynamic job generation
  - **Core Concepts:** Pipeline, stage, step, agent, Jenkinsfile, shared library, credentials binding
  - **Installation & Setup:** Jenkins Docker, install plugins (Git, Docker, Blue Ocean), create a pipeline job
  - **Beginner:** Declarative `Jenkinsfile` (pipeline, agent, stages, steps), `sh` step, `checkout scm`, environment block
  - **Intermediate:** Shared library (`@Library`), `vars/` global step functions, `src/` utility classes, credentials binding plugin, parallel stages, `post` (always, success, failure)
  - **Advanced:** Job DSL seed jobs (dynamically generate 50+ jobs from YAML config), Kubernetes dynamic agents (pod templates), pipeline as code best practices
  - **Expert:** Jenkins shared library testing with `JenkinsPipelineUnit`, Groovy sandbox restrictions, pipeline replay for debugging, migrating from Jenkins to GitHub Actions
  - **In the TML Codebase:** `ep-pipelines` shared library structure, job DSL seed pattern for per-service job generation, Ansible deploy trigger from Jenkins, Slack notifications on build status, legacy MES4/MES4-EV still on Jenkins
  - **Quick Reference:** Declarative Jenkinsfile skeleton, shared library step template, credentials binding syntax

- [ ] Commit:
```bash
git add docs/teaching/md/16-jenkins.md
git commit -m "docs: write Jenkins teaching doc (16)"
```

---

### Task 23: Write 17-argocd.md

**File:** `docs/teaching/md/17-argocd.md`

- [ ] Write the full document covering:
  - **Prerequisites:** Kubernetes (Task 19), Git basics
  - **What & Why:** GitOps — Git as the source of truth for cluster state, automated sync, drift detection
  - **Core Concepts:** Application CRD, sync, self-heal, prune, health status, `OutOfSync` vs `Synced`
  - **Installation & Setup:** `kubectl apply -n argocd -f install.yaml`, `argocd login`, `argocd app list`
  - **Beginner:** Create an Application YAML, manual sync (`argocd app sync`), view diff, rollback (`argocd app rollback`)
  - **Intermediate:** Sync policies (automated, self-heal, prune), hooks (`PreSync`, `PostSync`), resource exclusions, App of Apps pattern
  - **Advanced:** ApplicationSet for templating environments, `argocd-image-updater` for automatic image tag updates from ECR, multi-cluster management
  - **Expert:** ArgoCD HA setup, RBAC for ArgoCD projects, custom health checks, audit logging, SSO integration with Keycloak
  - **In the TML Codebase:** IPMS4 uses ArgoCD GitOps, `argocd/deploy/{env}/{app}/` directory structure, image updater watches ECR for new commit SHA tags, transition from Jenkins/Ansible deploy model
  - **Quick Reference:** Application YAML skeleton, `argocd` CLI reference, ApplicationSet template

- [ ] Commit:
```bash
git add docs/teaching/md/17-argocd.md
git commit -m "docs: write ArgoCD teaching doc (17)"
```

---

### Task 24: Write 18-ansible.md

**File:** `docs/teaching/md/18-ansible.md`

- [ ] Write the full document covering:
  - **Prerequisites:** Basic Linux, YAML
  - **What & Why:** Agentless configuration management, Jinja2 templating, Vault for secrets
  - **Core Concepts:** Inventory, playbook, task, role, handler, variable precedence, idempotency
  - **Installation & Setup:** `pip install ansible`, SSH key setup, `ansible -i inventory all -m ping`
  - **Beginner:** Inventory file, simple playbook (`hosts`, `tasks`, `name`, `ansible.builtin.copy`, `ansible.builtin.template`), variables and `vars_files`
  - **Intermediate:** Roles directory structure (`tasks/`, `handlers/`, `templates/`, `defaults/`), `ansible-galaxy`, Jinja2 templates (filters, conditionals, loops), `with_items` / `loop`
  - **Advanced:** Ansible Vault (`ansible-vault encrypt/decrypt/edit`), dynamic inventory (AWS EC2 plugin), `register` and `when` for conditional tasks, `async` for long tasks
  - **Expert:** Ansible Tower/AWX, performance tuning (pipelining, forking), testing Ansible with Molecule, custom modules
  - **In the TML Codebase:** Jinja2 templates generate per-environment Helm `values.yaml` files before `helm upgrade`, Ansible Vault stores encrypted secrets committed to the repo, playbooks triggered from Jenkins pipelines, `app-config/{env}/` structure
  - **Quick Reference:** Playbook skeleton, Vault command reference, common Jinja2 filters

- [ ] Commit:
```bash
git add docs/teaching/md/18-ansible.md
git commit -m "docs: write Ansible teaching doc (18)"
```

---

### Task 25: Write 19-observability.md

**File:** `docs/teaching/md/19-observability.md`

- [ ] Write the full document covering:
  - **Prerequisites:** Kubernetes (Task 19), Spring Boot (Task 8)
  - **What & Why:** The three pillars (metrics, logs, traces), SRE culture, on-call readiness
  - **Core Concepts:** Metrics (counters, gauges, histograms), logs (structured JSON), traces (spans, context propagation), dashboards, alerts
  - **Installation & Setup:** Prometheus + Grafana via `docker-compose`, import Spring Boot dashboard, `curl localhost:9096/actuator/prometheus`
  - **Beginner:** Reading Prometheus metrics output, PromQL basics (`rate()`, `sum()`, `by()`), Grafana panel creation, Kibana index patterns and KQL queries
  - **Intermediate:** Custom Micrometer metrics (`Counter.builder()`, `Timer.builder()`, `Gauge.builder()`), Spring Boot Actuator liveness/readiness probes in Kubernetes, Fluent Bit DaemonSet log collection config, structured logging with MDC
  - **Advanced:** Kafka consumer lag alerting (Prometheus `kafka_consumer_group_lag`), JVM memory and GC metrics, Alertmanager routing rules, EFK stack architecture (Fluent Bit → Elasticsearch → Kibana)
  - **Expert:** OpenTelemetry auto-instrumentation, distributed trace context propagation across Kafka messages (W3C TraceContext), Grafana SLO panels, on-call runbook structure
  - **In the TML Codebase:** All Spring Boot services expose Micrometer at `/actuator/prometheus` on port 9096, Kubernetes liveness maps to `/actuator/health/liveness`, EFK stack in each cluster, `ep-gmes-integration` uses OpenTelemetry, Grafana dashboards for consumer lag
  - **Quick Reference:** PromQL cheat sheet, MDC logging pattern, Alertmanager rule template

- [ ] Commit:
```bash
git add docs/teaching/md/19-observability.md
git commit -m "docs: write Observability & Monitoring teaching doc (19)"
```

---

### Task 26: Write 20-testing.md

**File:** `docs/teaching/md/20-testing.md`

- [ ] Write the full document covering:
  - **Prerequisites:** React (01), Spring Boot (02)
  - **What & Why:** Confidence in changes, TDD discipline, test pyramid (unit → integration → e2e)
  - **Core Concepts:** Test pyramid, unit vs integration vs e2e, arrange-act-assert, test isolation, mocking
  - **Installation & Setup:** `./gradlew test`, `npm test`, coverage commands per stack
  - **Beginner:** JUnit 5 basics (`@Test`, `assertEquals`, `assertThrows`), Jest basics (`describe`, `it`, `expect`), React Testing Library (`render`, `screen`, `userEvent`)
  - **Intermediate:** Mockito (`@Mock`, `@InjectMocks`, `when().thenReturn()`, `verify()`), `@SpringBootTest` vs `@WebMvcTest` vs `@DataJpaTest`, WireMock stubs, `@EmbeddedKafka`, H2 test config, `MockK` (`every`, `coEvery`, `verify`)
  - **Advanced:** Testcontainers (real PostgreSQL in Docker during tests), Kotest spec styles, Spring Kafka Test patterns, Gatling load test DSL, Jest mock modules (`jest.mock()`, `jest.spyOn()`), MSW for API mocking
  - **Expert:** Test design principles (what to mock vs not, testing behaviour not implementation), JaCoCo coverage thresholds in Gradle, Cypress e2e, mutation testing
  - **In the TML Codebase:** H2 + Flyway disabled pattern for Spring Boot tests, `./gradlew test --tests` for single class, WireMock for SAP Connector stubs, Kotest in `ep-replenishment`, Jest + RTL in React projects, `./setup.sh` pre-commit hook ensuring tests run
  - **Quick Reference:** JUnit 5 annotation reference, Mockito cheat sheet, RTL query priority guide

- [ ] Commit:
```bash
git add docs/teaching/md/20-testing.md
git commit -m "docs: write Testing teaching doc (20)"
```

---

### Task 27: Write 21-code-quality.md

**File:** `docs/teaching/md/21-code-quality.md`

- [ ] Write the full document covering:
  - **Prerequisites:** React (01), Spring Boot (02)
  - **What & Why:** Consistent code style reduces cognitive load, automated enforcement prevents debate
  - **Core Concepts:** Linting (find bugs/style issues), formatting (auto-fix whitespace/style), static analysis (deeper code quality)
  - **Installation & Setup:** `./setup.sh` for Java hooks, `npm install` for JS hooks, `./gradlew spotlessCheck`
  - **Beginner:** ESLint config (`.eslintrc.cjs`, `extends`, `rules`), Prettier config (`.prettierrc`), `npm run lint`, `npm run format`
  - **Intermediate:** Spotless Gradle plugin config (Google Java Format), `./gradlew spotlessApply`, Husky + lint-staged for pre-commit, TypeScript strict mode (`noImplicitAny`, `strictNullChecks`)
  - **Advanced:** Detekt for Kotlin (config, custom rules, `detekt.yml`), Checkstyle for Java, SonarQube integration (quality gates, coverage thresholds), ESLint custom plugin rules
  - **Expert:** Enforcing quality in CI (fail build on lint errors — `eslint --max-warnings 0`), code smell taxonomy, technical debt tracking
  - **In the TML Codebase:** Spotless enforced by `.githooks/pre-commit` (run `./setup.sh` once after clone), ESLint with `max-warnings 0` in GitHub Actions (breaks build), Prettier config per project, `qodana.yaml` in some repos for SonarQube-style scanning
  - **Quick Reference:** ESLint rule reference, Spotless Gradle DSL, Husky setup commands

- [ ] Commit:
```bash
git add docs/teaching/md/21-code-quality.md
git commit -m "docs: write Code Quality & Linting teaching doc (21)"
```

---

### Task 28: Write 22-data-export.md

**File:** `docs/teaching/md/22-data-export.md`

- [ ] Write the full document covering:
  - **Prerequisites:** React (01), Spring Boot (02) or Python Django (04)
  - **What & Why:** Manufacturing reporting requires Excel/PDF export, data ingestion from SAP via Excel files
  - **Core Concepts:** Workbook → Sheet → Row → Cell model, streaming vs in-memory for large files
  - **Installation & Setup:** Add Apache POI to Gradle, `openpyxl` to requirements.txt, `xlsx` to package.json
  - **Beginner:** Apache POI — create workbook, sheet, rows, cells, set cell values and types; `openpyxl` — same in Python; `xlsx` (SheetJS) — read uploaded file in React
  - **Intermediate:** Apache POI — cell styles (bold, borders, background colors, date formats), column width, merged cells, formula cells; generating Excel from JPA query results; `jspdf` + `jspdf-autotable` for PDF tables from React
  - **Advanced:** Streaming large Excel files with `SXSSFWorkbook` (Apache POI streaming API — avoids OOM), `exceljs` workbook streaming in Node.js, `react-to-pdf` for component-to-PDF
  - **Expert:** Excel template filling (read template, inject data, write output), CSV streaming with `opencsv` for millions of rows, `papaparse` web worker mode for large CSV in browser
  - **In the TML Codebase:** Apache POI in `ep-production-broadcast` (adherence reports), `ep-prolife-service` (production data sheets); OpenPyXL in `sadhan-auto-rep-backend`; `xlsx` in React UIs for file upload parsing; `jspdf` for QR code label sheets in `ep-prolife-service-ui`; `exceljs` in `ep-eloto`
  - **Quick Reference:** Apache POI workbook creation template, `openpyxl` write pattern, `jspdf-autotable` config

- [ ] Commit:
```bash
git add docs/teaching/md/22-data-export.md
git commit -m "docs: write Data Export & File Processing teaching doc (22)"
```

---

### Task 29: Write 23-external-integrations.md

**File:** `docs/teaching/md/23-external-integrations.md`

- [ ] Write the full document covering:
  - **Prerequisites:** Spring Boot (02), Kafka (09)
  - **What & Why:** Manufacturing systems integrate with legacy SAP ERP, IoT machines, and logistics APIs
  - **Core Concepts:** RFC (Remote Function Call), MQTT, REST integration patterns, circuit breaker, retry
  - **Installation & Setup:** SAP JCo requires JDK 11 (native library) — note this constraint; MQTT broker via `docker run eclipse-mosquitto`
  - **Beginner:** OkHttp3 REST client (`OkHttpClient`, `Request.Builder`, `Response`), `Ktor Client` for Kotlin (async `get {}`, `post {}`), basic MQTT subscribe/publish
  - **Intermediate:** SAP JCo integration — `JCoDestinationManager`, `JCoRepository`, `JCoFunction`, RFC call (`ZPPRFC_MES_MARDSTOCK`), response parsing; AWS IoT Device SDK MQTT subscription; Freight Tiger REST API (trip create/close)
  - **Advanced:** Rate limiting SAP calls (120-minute minimum interval, max 500 materials), Kafka-to-SAP bridge pattern in `ep-sap-connector`, BU-specific connection config, error handling for RFC failures
  - **Expert:** SAP JCo connection pool tuning, MQTT QoS levels (0/1/2), certificate management for IoT devices, circuit breaker pattern (Resilience4j) for unstable external APIs
  - **In the TML Codebase:** `ep-sap-connector` bridges Kafka to SAP RFC (JDK 11 for JCo, RFC `ZPPRFC_MES_MARDSTOCK`, 500-material batch limit, 120-min interval); `ep-machine-integration` AWS IoT SDK MQTT subscription → S3 upload → Kafka publish; Freight Tiger in `ep-production-broadcast` (OkHttp3)
  - **Quick Reference:** SAP JCo connection config properties, MQTT topic subscription pattern, OkHttp3 request builder template

- [ ] Commit:
```bash
git add docs/teaching/md/23-external-integrations.md
git commit -m "docs: write External Integrations teaching doc (23)"
```

---

### Task 30: Write 24-shared-patterns.md

**File:** `docs/teaching/md/24-shared-patterns.md`

- [ ] Write the full document covering:
  - **Prerequisites:** All 23 prior docs
  - **What & Why:** Cross-cutting conventions that appear in every repo — knowing them makes you productive immediately
  - **Core Concepts:** Convention over configuration, single responsibility, defensive coding at boundaries only
  - **Installation & Setup:** N/A — this doc is about patterns, not a new tool
  - **Beginner:** Project naming conventions (product-line prefix: `ep-`, `pv-`, `sadhan-`, etc.), branch naming and CI triggers (`development`, `master`, `pre-prod`)
  - **Intermediate:** Multi-BU routing pattern (CVBU/PVBU/EVBU, BU codes in Kafka messages and REST params), plant-scoped authorization (every operation takes `plantCode`, calls `ep-authorization`), Kafka message envelope (eventType, version, timestamp, payload), API response envelope
  - **Advanced:** Archive table pattern (operational → archive on fulfillment), feature toggle pattern (`feature-toggle.*: false` in YAML), UI flow config in `application.yaml`, `adherence-report.plant.disabled` exclusion list
  - **Expert:** Environment configuration hierarchy (`.envrc` → GitHub Secrets → Ansible Vault → AWS Secrets Manager), multi-context/multi-environment Terraform structure, GitOps vs Jenkins model selection (IPMS4 vs legacy MES4), IRSA pod identity pattern
  - **In the TML Codebase:** All patterns in this doc ARE TML codebase patterns — examples from actual repos for each one
  - **Quick Reference:** Convention cheat sheet, BU code reference table, environment secret hierarchy diagram

- [ ] Commit:
```bash
git add docs/teaching/md/24-shared-patterns.md
git commit -m "docs: write Shared Patterns & Conventions teaching doc (24)"
```

---

## Task 31: Final Integration Check

- [ ] **Step 1: Build the portal**

```bash
cd /home/somasekhar/Desktop/TML_Repos/docs/teaching/portal
npm run build
```
Expected: `dist/` folder created, no build errors.

- [ ] **Step 2: Preview production build**

```bash
npm run preview
```
Open `http://localhost:4173`. Verify:
- Home page shows all 24 topic cards
- Navigate to 3–4 topics — DocViewer renders the MD content correctly
- Code blocks are syntax highlighted with copy buttons
- `Ctrl+K` opens search and returns results
- Dark/light mode toggle works
- Progress state persists after page refresh (localStorage)
- Prev/Next navigation works

- [ ] **Step 3: Final commit**

```bash
cd /home/somasekhar/Desktop/TML_Repos
git add .
git commit -m "feat: complete TML teaching portal — 24 docs + React SPA"
```

---

## Summary

| Phase | Tasks | Deliverable |
|-------|-------|------------|
| Portal scaffold | 1 | Vite + React 18 project |
| Data & hooks | 2 | Curriculum data, progress tracking, search index |
| UI components | 3–4 | Navbar, Sidebar, SearchBar, DocViewer, ProgressBar, TopicCard |
| Pages & wiring | 5 | Home, Topic pages, App with routing |
| MD stubs | 6 | 24 placeholder files confirming portal loads |
| Teaching docs | 7–30 | 24 complete expert-level teaching documents |
| Verification | 31 | Production build check |

**Total tasks: 31 | Total commits: ~32**
