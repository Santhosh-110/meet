import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Send, X } from 'lucide-react'
import type { ChatMessage } from '../../types/webrtc'

interface ChatPanelProps {
  messages: ChatMessage[]
  localPeerId: string | null
  localDisplayName: string
  onSendMessage: (text: string) => void
  onClose: () => void
}

export function ChatPanel({
  messages,
  localPeerId,
  localDisplayName,
  onSendMessage,
  onClose,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return
    onSendMessage(inputText.trim())
    setInputText('')
  }, [inputText, onSendMessage])

  const formatTime = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', {
      timeStyle: 'short',
    }).format(new Date(ts))
  };

  return (
    <div style={{
      width: '360px',
      height: '100%',
      background: '#1e293b', // Dark theme matching Google Meet overhaul
      borderLeft: '1px solid #334155',
      display: 'flex',
      flexDirection: 'column',
      color: '#f8fafc',
      fontFamily: "'Google Sans', 'Inter', sans-serif",
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>In-call messages</h2>
        <button
          onClick={onClose}
          aria-label="Close chat"
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '0.25rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 150ms, color 150ms',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#334155'
            e.currentTarget.style.color = '#f8fafc'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'none'
            e.currentTarget.style.color = '#94a3b8'
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Info notice */}
      <div style={{
        padding: '0.75rem 1.5rem',
        background: '#0f172a',
        fontSize: '0.75rem',
        color: '#94a3b8',
        lineHeight: 1.5,
        borderBottom: '1px solid #334155',
      }}>
        Messages can only be seen by people in the call and are deleted when the call ends.
      </div>

      {/* Message List */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {messages.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            color: '#64748b',
            textAlign: 'center',
            gap: '0.5rem',
            padding: '2rem',
          }}>
            <span style={{ fontSize: '0.875rem' }}>No messages yet</span>
            <span style={{ fontSize: '0.75rem', maxWidth: '200px' }}>
              Send a message to share links or ask questions.
            </span>
          </div>
        ) : (
          messages.map((msg) => {
            const isLocal = msg.peerId === localPeerId || msg.peerId === 'local'
            return (
              <div key={msg.id} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isLocal ? 'flex-end' : 'flex-start',
                width: '100%',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.25rem',
                  fontSize: '0.75rem',
                }}>
                  <span style={{
                    fontWeight: 600,
                    color: isLocal ? '#38bdf8' : '#cbd5e1',
                  }}>
                    {isLocal ? 'You' : msg.displayName}
                  </span>
                  <span style={{ color: '#64748b' }}>{formatTime(msg.timestamp)}</span>
                </div>
                <div style={{
                  maxWidth: '85%',
                  padding: '0.75rem 1rem',
                  borderRadius: '1rem',
                  borderTopRightRadius: isLocal ? '0.25rem' : '1rem',
                  borderTopLeftRadius: isLocal ? '1rem' : '0.25rem',
                  background: isLocal ? '#2563eb' : '#334155',
                  color: '#fff',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                }}>
                  {msg.text}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input panel */}
      <form onSubmit={handleSend} style={{
        padding: '1.25rem 1.5rem',
        borderTop: '1px solid #334155',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
      }}>
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Send a message"
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: '1.5rem',
            border: '1px solid #475569',
            background: '#0f172a',
            color: '#fff',
            fontSize: '0.875rem',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          aria-label="Send message"
          style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '50%',
            border: 'none',
            background: inputText.trim() ? '#2563eb' : '#334155',
            color: inputText.trim() ? '#fff' : '#64748b',
            cursor: inputText.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 150ms, color 150ms',
          }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
