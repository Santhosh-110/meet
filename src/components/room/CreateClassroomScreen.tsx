import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Video,
  ArrowLeft,
  User,
  KeyRound,
  Link2,
  Copy,
  Check,
  Share2,
  AlertCircle
} from 'lucide-react'

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

export function CreateClassroomScreen() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [nameError, setNameError] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdMeeting, setCreatedMeeting] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      setNameError('Please enter your name to start a classroom.')
      return
    }
    setNameError('')
    setLoading(true)

    try {
      const res = await fetch(`${getApiUrl()}/api/meetings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teacherId: displayName.trim(),
          password: password.trim() || undefined,
        }),
      })

      if (!res.ok) throw new Error('API returned error status')
      const data = await res.json()
      if (data.success && data.meeting) {
        setCreatedMeeting(data.meeting)
      } else {
        throw new Error(data.error || 'Failed to create meeting')
      }
    } catch (err) {
      console.error('Create meeting failed:', err)
      alert('Failed to connect to signaling server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = useCallback(async () => {
    if (!createdMeeting) return
    const meetingLink = `${window.location.origin}/classroom/${createdMeeting.meetingId}`
    try {
      await navigator.clipboard.writeText(meetingLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = meetingLink
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [createdMeeting])

  const handleJoin = () => {
    if (!createdMeeting) return
    navigate(`/classroom/${createdMeeting.meetingId}`, {
      state: {
        role: 'teacher',
        displayName: displayName.trim(),
        directJoin: true,
      },
    })
  }

  const inputBase = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    paddingLeft: '2.75rem',
    paddingRight: '1rem',
    paddingTop: '0.8125rem',
    paddingBottom: '0.8125rem',
    borderRadius: '0.75rem',
    border: `1.5px solid ${hasError ? '#fca5a5' : '#cbd5e1'}`,
    background: hasError ? '#fff5f5' : '#f8fafc',
    fontSize: '0.9375rem',
    color: '#1e293b',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 200ms',
  })

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: "'Google Sans', 'Inter', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      color: '#1e293b',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '1.25rem',
        boxShadow: '0 20px 50px rgba(0,0,0,0.06)',
        border: '1px solid #e2e8f0',
        width: '100%',
        maxWidth: '460px',
        padding: '2.5rem',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        {/* Banner Icon */}
        <div style={{
          width: '3.75rem',
          height: '3.75rem',
          borderRadius: '50%',
          background: '#eff6ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
        }}>
          <Video size={28} style={{ color: '#2563eb' }} />
        </div>

        {!createdMeeting ? (
          /* ──────────────── Creation Form ──────────────── */
          <form onSubmit={handleCreate} style={{ width: '100%', textAlign: 'left' }}>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: '#0f172a',
              margin: '0 0 0.5rem',
              textAlign: 'center',
              letterSpacing: '-0.015em',
            }}>Create Virtual Classroom</h1>
            
            <p style={{
              fontSize: '0.875rem',
              color: '#64748b',
              textAlign: 'center',
              lineHeight: 1.6,
              margin: '0 0 2rem',
            }}>
              Configure name and details below to start a classroom session.
            </p>

            {/* Teacher Name Input */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                htmlFor="teacher-name-input"
                style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', letterSpacing: '0.01em' }}
              >
                Your Name (Teacher) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: nameError ? '#ef4444' : '#94a3b8',
                  pointerEvents: 'none',
                }} />
                <input
                  id="teacher-name-input"
                  type="text"
                  value={displayName}
                  onChange={e => { setDisplayName(e.target.value); if (nameError) setNameError('') }}
                  placeholder="Enter your name"
                  style={inputBase(!!nameError)}
                />
              </div>
              {nameError && (
                <p style={{
                  fontSize: '0.8rem',
                  color: '#ef4444',
                  marginTop: '0.4rem',
                  margin: '0.4rem 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}>
                  <AlertCircle size={13} /> {nameError}
                </p>
              )}
            </div>

            {/* Optional Passcode Input */}
            <div style={{ marginBottom: '2rem' }}>
              <label
                htmlFor="meeting-passcode-input"
                style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', letterSpacing: '0.01em' }}
              >
                Classroom Password <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={18} style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }} />
                <input
                  id="meeting-passcode-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create passcode for students"
                  style={inputBase(false)}
                />
              </div>
            </div>

            {/* Submit / Back */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
                  transition: 'all 200ms',
                }}
              >
                {loading ? 'Generating...' : 'Create Classroom'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  borderRadius: '0.75rem',
                  border: '1.5px solid #e2e8f0',
                  background: '#fff',
                  color: '#64748b',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 200ms',
                }}
              >
                <ArrowLeft size={16} />
                Back to Home
              </button>
            </div>
          </form>
        ) : (
          /* ──────────────── Share Screen ──────────────── */
          <div style={{ width: '100%', textAlign: 'left' }}>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: '#16a34a',
              margin: '0 0 0.5rem',
              textAlign: 'center',
              letterSpacing: '-0.015em',
            }}>Classroom Created Successfully!</h1>
            
            <p style={{
              fontSize: '0.875rem',
              color: '#64748b',
              textAlign: 'center',
              lineHeight: 1.6,
              margin: '0 0 2rem',
            }}>
              Your classroom is active. Share the link with your students.
            </p>

            {/* Meeting Link display Box */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.75rem',
              padding: '1rem',
              marginBottom: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Link2 size={14} style={{ color: '#2563eb' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Join Link</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#1e293b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '280px',
                }}>{`${window.location.origin}/classroom/${createdMeeting.meetingId}`}</span>
                <button
                  onClick={handleCopyLink}
                  style={{
                    padding: '0.35rem 0.625rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #cbd5e1',
                    background: copied ? '#f0fdf4' : '#fff',
                    color: copied ? '#16a34a' : '#1e293b',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    transition: 'all 150ms',
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Passcode Box (if set) */}
            {createdMeeting.password && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.75rem',
                padding: '1rem',
                marginBottom: '2rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <KeyRound size={14} style={{ color: '#d97706' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Access Password</span>
                </div>
                <span style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  fontFamily: 'monospace',
                }}>{createdMeeting.password}</span>
              </div>
            )}

            {/* CTA Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
              <button
                onClick={handleJoin}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                  transition: 'all 200ms',
                }}
              >
                Join Classroom
              </button>
              <button
                onClick={() => setCreatedMeeting(null)}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  borderRadius: '0.75rem',
                  border: '1.5px solid #e2e8f0',
                  background: '#fff',
                  color: '#64748b',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 200ms',
                }}
              >
                Create Another Meeting
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
