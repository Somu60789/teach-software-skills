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
