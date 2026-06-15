import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Video,
  ArrowRight,
  User,
  Users,
  Monitor,
  Link2,
  AlertCircle,
} from 'lucide-react'
import type { Role, MeetingInfo } from '../../types/webrtc'
import { MeetingCodeModal } from './MeetingCodeModal'

// ─────────────────────────────────────────────────────────────────────────────
// INSTANT meeting code generation — zero network calls.
//
// Why no server round-trip?
//   The SFU backend uses getOrCreateRoom(roomId) which creates rooms on demand.
//   So any unique string is a valid roomId. We generate it on the frontend
//   using crypto.getRandomValues() for strong randomness and use it directly
//   as both the meeting code AND the roomId. This eliminates all latency.
//
// Format: abc-defg-hij  (3-4-3 lowercase alpha, like Google Meet)
// Collision probability: 26^10 ≈ 1.4 × 10^14 — negligible.
// ─────────────────────────────────────────────────────────────────────────────
function generateMeetingCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  // Use crypto.getRandomValues for better entropy than Math.random()
  const rand = (len: number): string => {
    const bytes = new Uint8Array(len)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => chars[b % chars.length]).join('')
  }
  return `${rand(3)}-${rand(4)}-${rand(3)}`
}

// Helper to get the correct API URL for meeting creation
const getApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_SIGNALING_URL
  if (envUrl) {
    return envUrl.replace(/\/+$/, '')
  }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001'
  }
  return window.location.origin
}

// Validate code format client-side — instant, no network.
// Accepts: abc-defg-hij  (3 alpha, dash, 4 alpha, dash, 3 alpha)
function isValidCodeFormat(code: string): boolean {
  return /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(code.trim().toLowerCase())
}

// Normalise user-entered code: trim whitespace, lowercase.
// Also handle codes pasted with spaces instead of dashes.
function normaliseCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-')
}

interface JoinFormProps {
  onJoin: (roomId: string, role: Role, displayName: string, directJoin?: boolean) => void
}

export function JoinForm({ onJoin }: JoinFormProps) {
  const [displayName, setDisplayName] = useState('')
  const [meetingCode, setMeetingCode] = useState('')
  const [nameError, setNameError] = useState('')
  const [codeError, setCodeError] = useState('')
  const [pendingMeeting, setPendingMeeting] = useState<MeetingInfo | null>(null)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Live clock — ticks every second
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { nameInputRef.current?.focus() }, [])

  // Pre-fill code from ?room=abc-defg-hij URL param
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('room')
    if (code) setMeetingCode(code)
  }, [])

  // ── Your Name Validation ───────────────────────────────────────────────
  const requireName = useCallback((): boolean => {
    if (!displayName.trim()) {
      setNameError('Please enter your name to continue.')
      nameInputRef.current?.focus()
      return false
    }
    setNameError('')
    return true
  }, [displayName])

  // ── New Meeting — backend create & instant join ─────────────────────────
  const handleInstantMeeting = useCallback(async () => {
    if (!requireName()) return
    try {
      const res = await fetch(`${getApiUrl()}/api/meetings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teacherId: displayName.trim(),
        }),
      })
      if (!res.ok) throw new Error('Failed to create meeting')
      const data = await res.json()
      if (data.success && data.meeting) {
        onJoin(data.meeting.meetingId, 'teacher', displayName.trim(), true)
      } else {
        throw new Error(data.error || 'Failed to create meeting')
      }
    } catch (err) {
      console.error(err)
      alert('Could not start classroom session. Please try again.')
    }
  }, [requireName, displayName, onJoin])

  // ── Create for Later — backend create & show modal ─────────────────────
  const handleCreateForLater = useCallback(async () => {
    if (!requireName()) return
    try {
      const res = await fetch(`${getApiUrl()}/api/meetings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teacherId: displayName.trim(),
        }),
      })
      if (!res.ok) throw new Error('Failed to create meeting')
      const data = await res.json()
      if (data.success && data.meeting) {
        setPendingMeeting({
          meetingId: data.meeting.meetingId,
          roomId: data.meeting.roomId,
          createdAt: data.meeting.createdAt,
          status: data.meeting.status,
          password: data.meeting.password,
          participantCount: data.meeting.participantCount
        })
      } else {
        throw new Error(data.error || 'Failed to create meeting')
      }
    } catch (err) {
      console.error(err)
      alert('Could not create classroom session. Please try again.')
    }
  }, [requireName, displayName])

  // ── Join by code — verify on server first, then route ──────────────────
  const handleJoinByCode = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requireName()) return

    const code = normaliseCode(meetingCode)

    if (!code) {
      setCodeError('Please enter a meeting code.')
      return
    }

    if (!isValidCodeFormat(code)) {
      setCodeError('Invalid format. Meeting codes look like: abc-defg-hij')
      return
    }

    setCodeError('')
    setVerifyingCode(true)

    try {
      const res = await fetch(`${getApiUrl()}/api/meetings/${code}`)
      if (!res.ok) throw new Error('Failed to verify meeting')
      const data = await res.json()
      
      if (!data.exists) {
        setCodeError('This classroom does not exist.')
      } else if (data.status === 'ended') {
        setCodeError('This classroom session has ended.')
      } else if (data.participantCount >= 25) {
        setCodeError('This classroom is full (max 25 participants).')
      } else {
        // Proceed to lobby/join route
        onJoin(code, 'student', displayName.trim(), false)
      }
    } catch (err) {
      console.error(err)
      setCodeError('Failed to verify classroom. Please try again.')
    } finally {
      setVerifyingCode(false)
    }
  }, [requireName, meetingCode, displayName, onJoin])

  // ── Modal callbacks ────────────────────────────────────────────────────
  const handleModalJoin = useCallback((roomId: string) => {
    setPendingMeeting(null)
    onJoin(roomId, 'teacher', displayName.trim(), false)
  }, [displayName, onJoin])

  const handleModalClose = useCallback(() => setPendingMeeting(null), [])

  const nameFilled = displayName.trim().length > 0
  const codeFilled = meetingCode.trim().length > 0

  // ── Inline style helpers (keeps JSX readable) ──────────────────────────
  const inputBase = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    paddingLeft: '2.75rem',
    paddingRight: '1rem',
    paddingTop: '0.875rem',
    paddingBottom: '0.875rem',
    borderRadius: '0.75rem',
    border: `1.5px solid ${hasError ? '#fca5a5' : '#e2e8f0'}`,
    background: hasError ? '#fff5f5' : '#f8fafc',
    fontSize: '0.9375rem',
    color: '#1e293b',
    outline: 'none',
    transition: 'border-color 200ms, background 200ms, box-shadow 200ms',
    boxSizing: 'border-box',
    boxShadow: hasError ? '0 0 0 3px rgba(239,68,68,0.08)' : 'none',
  })

  const onInputFocus = (hasError: boolean) => (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = hasError ? '#ef4444' : '#93c5fd'
    e.currentTarget.style.boxShadow = hasError
      ? '0 0 0 3px rgba(239,68,68,0.08)'
      : '0 0 0 3px rgba(59,130,246,0.1)'
  }

  const onInputBlur = (hasError: boolean) => (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = hasError ? '#fca5a5' : '#e2e8f0'
    e.currentTarget.style.boxShadow = hasError ? '0 0 0 3px rgba(239,68,68,0.08)' : 'none'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: "'Google Sans', 'Inter', sans-serif" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
        <div 
          onClick={() => window.location.href = '/'}
          style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}
          title="LearnLink Home"
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 9L11 13.5V18C11 23.052 14.948 27.414 20 28.5C25.052 27.414 29 23.052 29 18V13.5L20 9Z" stroke="#1a73e8" strokeWidth="2.5" fill="none"/>
            <circle cx="20" cy="16" r="3" fill="#1a73e8"/>
            <path d="M13 20V24C13 26.761 16.239 29 19 29H21C23.761 29 27 26.761 27 24V20" stroke="#1a73e8" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          </svg>
          <span style={{ fontSize: '1.375rem', fontWeight: 500, color: '#1e293b', letterSpacing: '-0.01em' }}>LearnLink</span>
        </div>

        {/* Right side: Live Clock + Calendar Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Live Clock */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
            <span style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#1e293b',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.01em',
              lineHeight: 1.2,
            }}>
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span style={{
              fontSize: '0.75rem',
              color: '#64748b',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}>
              {now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          {/* Divider */}
          <div style={{ width: '1px', height: '2rem', background: '#e2e8f0' }} />
          {/* Calendar Icon */}
          <button
            aria-label="Schedule"
            title="Schedule"
            style={{ padding: '0.625rem', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', transition: 'background 150ms' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth="2" width="22" height="22">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </button>
        </div>
      </header>


      {/* ── Main layout ──────────────────────────────────────────────────── */}
      <main style={{
        maxWidth: '1120px', margin: '0 auto',
        padding: '3rem 1.5rem 4rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '3rem',
        alignItems: 'center',
      }}>

        {/* Left column ─ actions */}
        <div>
          <h1 style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', fontWeight: 400, color: '#1e293b', lineHeight: 1.15, margin: '0 0 0.75rem' }}>
            Virtual classroom<br />
            <span style={{ color: '#94a3b8' }}>for everyone</span>
          </h1>
          <p style={{ fontSize: '1.0625rem', color: '#64748b', lineHeight: 1.7, margin: '0 0 2.5rem', maxWidth: '420px' }}>
            Connect, collaborate, and learn together with real-time video sessions.
          </p>

          {/* ── Your Name ──────────────────────────────────────────────── */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label
              htmlFor="display-name-input"
              style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem', letterSpacing: '0.01em' }}
            >
              Your Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: nameError ? '#ef4444' : '#94a3b8', pointerEvents: 'none' }} />
              <input
                id="display-name-input"
                ref={nameInputRef}
                type="text"
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); if (nameError) setNameError('') }}
                onKeyDown={e => e.key === 'Enter' && nameFilled && handleInstantMeeting()}
                placeholder="Enter your name to get started"
                autoComplete="name"
                style={inputBase(!!nameError)}
                onFocus={onInputFocus(!!nameError)}
                onBlur={onInputBlur(!!nameError)}
              />
            </div>
            {nameError && (
              <p id="name-error-msg" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#ef4444', marginTop: '0.4rem', margin: '0.4rem 0 0' }}>
                <AlertCircle size={13} /> {nameError}
              </p>
            )}
            {nameFilled && !nameError && (
              <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0.4rem 0 0' }}>
                Welcome, <strong style={{ color: '#374151' }}>{displayName}</strong>! What would you like to do?
              </p>
            )}
          </div>

          {/* ── New Meeting buttons ─────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>

            {/* Instant meeting */}
            <button
              id="start-instant-meeting-btn"
              onClick={handleInstantMeeting}
              disabled={!nameFilled}
              title={nameFilled ? 'Start an instant meeting' : 'Enter your name first'}
              style={{
                flex: '1 1 150px',
                padding: '0.875rem 1.25rem',
                borderRadius: '0.75rem',
                border: 'none',
                background: nameFilled
                  ? 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)'
                  : '#e2e8f0',
                color: nameFilled ? '#fff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.9375rem',
                cursor: nameFilled ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: nameFilled ? '0 4px 14px rgba(37,99,235,0.3)' : 'none',
                transition: 'box-shadow 200ms ease, background 200ms ease',
              }}
              onMouseEnter={e => nameFilled && (e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,0.48)')}
              onMouseLeave={e => nameFilled && (e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,0.3)')}
            >
              <Video size={18} />
              New Meeting
            </button>

            {/* Create for later */}
            <button
              id="create-meeting-for-later-btn"
              onClick={handleCreateForLater}
              disabled={!nameFilled}
              title={nameFilled ? 'Get a shareable meeting code' : 'Enter your name first'}
              style={{
                flex: '1 1 150px',
                padding: '0.875rem 1.25rem',
                borderRadius: '0.75rem',
                border: `1.5px solid ${nameFilled ? '#bfdbfe' : '#e2e8f0'}`,
                background: nameFilled ? '#eff6ff' : '#f8fafc',
                color: nameFilled ? '#1d4ed8' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.9375rem',
                cursor: nameFilled ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'background 200ms ease, border-color 200ms ease',
              }}
              onMouseEnter={e => nameFilled && (e.currentTarget.style.background = '#dbeafe')}
              onMouseLeave={e => nameFilled && (e.currentTarget.style.background = '#eff6ff')}
            >
              <Link2 size={17} />
              Create for Later
            </button>
          </div>

          {/* ── Divider ────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>or join with a code</span>
            <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
          </div>

          {/* ── Join by meeting code ────────────────────────────────────── */}
          <form id="join-by-code-form" onSubmit={handleJoinByCode} noValidate>
            <label
              htmlFor="meeting-code-input"
              style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem', letterSpacing: '0.01em' }}
            >
              Meeting Code
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <ArrowRight
                  size={17}
                  style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%) rotate(180deg)', color: codeError ? '#ef4444' : '#94a3b8', pointerEvents: 'none' }}
                />
                <input
                  id="meeting-code-input"
                  type="text"
                  value={meetingCode}
                  onChange={e => { setMeetingCode(e.target.value); if (codeError) setCodeError('') }}
                  placeholder="abc-defg-hij"
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    ...inputBase(!!codeError),
                    letterSpacing: '0.05em',
                    fontFamily: "'Courier New', Courier, monospace",
                  }}
                  onFocus={onInputFocus(!!codeError)}
                  onBlur={onInputBlur(!!codeError)}
                />
              </div>
              <button
                id="join-by-code-btn"
                type="submit"
                disabled={!nameFilled || !codeFilled || verifyingCode}
                style={{
                  padding: '0.875rem 1.375rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  background: (nameFilled && codeFilled && !verifyingCode) ? '#1e293b' : '#f1f5f9',
                  color: (nameFilled && codeFilled && !verifyingCode) ? '#fff' : '#94a3b8',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: (!nameFilled || !codeFilled || verifyingCode) ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'background 150ms, box-shadow 150ms',
                  boxShadow: (nameFilled && codeFilled && !verifyingCode) ? '0 2px 8px rgba(30,41,59,0.2)' : 'none',
                }}
                onMouseEnter={e => (nameFilled && codeFilled && !verifyingCode) && (e.currentTarget.style.background = '#0f172a')}
                onMouseLeave={e => (nameFilled && codeFilled && !verifyingCode) && (e.currentTarget.style.background = '#1e293b')}
              >
                {verifyingCode ? 'Joining...' : 'Join'}
              </button>
            </div>

            {codeError && (
              <p id="code-error-msg" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#ef4444', margin: '0.45rem 0 0' }}>
                <AlertCircle size={13} /> {codeError}
              </p>
            )}
          </form>
        </div>

        {/* Right column ─ Hero Image & Info */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '2rem',
          padding: '2rem 1.5rem',
          background: '#f8fafc',
          borderRadius: '1.5rem',
          border: '1px solid #f1f5f9',
          boxSizing: 'border-box'
        }}>
          <div style={{ 
            width: '100%', 
            maxWidth: '400px', 
            borderRadius: '1.25rem', 
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.08)',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            boxSizing: 'border-box'
          }}>
            <img 
              src="/images/videocall.png" 
              alt="Virtual classroom video calling session" 
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: '0.875rem',
                display: 'block',
              }}
            />
          </div>
          
          <div style={{ textAlign: 'center', maxWidth: '360px' }}>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 500, color: '#0f172a', margin: '0 0 0.5rem', letterSpacing: '-0.01em' }}>
              Connect with your classroom
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Create a link and share it with students to start secure video calling sessions, screen sharing, and real-time messaging.
            </p>
          </div>

          {/* Dots Indicator for Carousel feel */}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '-0.5rem' }}>
            <span style={{ width: '1.5rem', height: '6px', borderRadius: '3px', background: '#2563eb' }} />
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#cbd5e1' }} />
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#cbd5e1' }} />
          </div>
        </div>
      </main>

      {/* ── Meeting code modal ─────────────────────────────────────────── */}
      {pendingMeeting && (
        <MeetingCodeModal
          meeting={pendingMeeting}
          onJoin={handleModalJoin}
          onClose={handleModalClose}
        />
      )}

      <style>{`
        * { box-sizing: border-box; }
        input::placeholder { color: #94a3b8; }
      `}</style>
    </div>
  )
}