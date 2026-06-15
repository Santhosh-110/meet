import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useLocalMedia } from '../../hooks/useLocalMedia'
import { PreJoinScreen } from './PreJoinScreen'
import { Classroom } from './Classroom'
import { ClassroomUnavailableScreen } from './ClassroomUnavailableScreen'
import type { Role } from '../../types/webrtc'
import { Lock, ShieldAlert, KeyRound, AlertCircle } from 'lucide-react'

// Helper to get the correct API URL for room validation
const getApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_SIGNALING_URL
  if (envUrl) {
    // Strip trailing slashes to avoid double slashes
    return envUrl.replace(/\/+$/, '')
  }
  // Fallback for development/production
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001'
  }
  return window.location.origin
}

export function MeetingRouteWrapper() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // Extract navigation state if redirected from JoinForm
  const navState = location.state as { role?: Role; displayName?: string; directJoin?: boolean } | null

  const [displayName, setDisplayName] = useState(navState?.displayName || '')
  const [role, setRole] = useState<Role>(navState?.role || 'student')
  const [isJoined, setIsJoined] = useState(navState?.directJoin || false)
  const [validationState, setValidationState] = useState<'checking' | 'exists' | 'not_found' | 'ended' | 'full' | 'password_required'>('checking')
  
  // Password and verification states
  const [password, setPassword] = useState('')
  const [enteredPassword, setEnteredPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [verifyingPassword, setVerifyingPassword] = useState(false)

  // localMedia handles getUserMedia stream and hardware toggles
  const localMedia = useLocalMedia({ video: true, audio: true })

  // Skipped validation if creator navigated directly with teacher state
  const skipValidation = navState?.role === 'teacher'

  useEffect(() => {
    if (skipValidation) {
      setValidationState('exists')
      return
    }

    if (!roomId) {
      setValidationState('not_found')
      return
    }

    let active = true
    const apiUrl = `${getApiUrl()}/api/meetings/${roomId}`

    async function validateRoom() {
      try {
        const res = await fetch(apiUrl)
        if (!res.ok) throw new Error('API returned error status')
        const data = await res.json()
        if (active) {
          if (!data.exists) {
            setValidationState('not_found')
          } else if (data.status === 'ended') {
            setValidationState('ended')
          } else if (data.participantCount >= 25) {
            setValidationState('full')
          } else if (data.hasPassword && role !== 'teacher') {
            setValidationState('password_required')
          } else {
            setValidationState('exists')
          }
        }
      } catch (err) {
        console.error('Failed to validate room existence:', err)
        if (active) {
          // Resilient fallback: allow user to attempt joining even if API validation fails
          setValidationState('exists')
        }
      }
    }

    validateRoom()

    return () => {
      active = false
    }
  }, [roomId, skipValidation, role])

  const handleVerifyPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enteredPassword.trim()) {
      setPasswordError('Please enter the classroom passcode.')
      return
    }
    setPasswordError('')
    setVerifyingPassword(true)

    try {
      const apiUrl = `${getApiUrl()}/api/meetings/${roomId}/verify`
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: enteredPassword.trim() }),
      })
      
      const data = await res.json()
      if (res.ok && data.success) {
        setPassword(enteredPassword.trim())
        setValidationState('exists')
      } else {
        setPasswordError(data.error || 'Incorrect passcode. Please try again.')
      }
    } catch (err) {
      console.error('Passcode verification failed:', err)
      setPasswordError('Connection error. Please try again.')
    } finally {
      setVerifyingPassword(false)
    }
  }, [enteredPassword, roomId])

  const handleJoin = useCallback(() => {
    setIsJoined(true)
  }, [])

  const handleBack = useCallback(() => {
    localMedia.stopMedia()
    navigate('/', { replace: true })
  }, [localMedia, navigate])

  const handleLeave = useCallback(() => {
    localMedia.stopMedia()
    navigate('/', { replace: true })
  }, [localMedia, navigate])

  const handleUpdateName = useCallback((name: string) => {
    setDisplayName(name)
  }, [])

  // 1. Loading State
  if (validationState === 'checking') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#fff',
        fontFamily: "'Google Sans', 'Inter', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
      }}>
        <div style={{
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: '50%',
          border: '3px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: '#3b82f6',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{
          fontSize: '1rem',
          color: '#cbd5e1',
          fontWeight: 500,
          letterSpacing: '0.01em',
        }}>Verifying meeting room...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  // 2. Unavailable Screen (Not Found, Ended, Full states)
  if ((validationState === 'not_found' || validationState === 'ended' || validationState === 'full') && roomId) {
    return (
      <ClassroomUnavailableScreen
        roomId={roomId}
        onBack={handleBack}
        reason={validationState}
      />
    )
  }

  // 3. Password Required Screen
  if (validationState === 'password_required' && roomId) {
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
          maxWidth: '440px',
          padding: '2.5rem',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}>
          {/* Lock Icon Badge */}
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
            <Lock size={26} style={{ color: '#2563eb' }} />
          </div>

          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            color: '#0f172a',
            margin: '0 0 0.5rem',
            letterSpacing: '-0.015em',
          }}>Passcode Required</h1>

          <p style={{
            fontSize: '0.9375rem',
            color: '#64748b',
            lineHeight: 1.6,
            margin: '0 0 2rem',
          }}>
            This classroom is private. Enter the passcode provided by the teacher to join.
          </p>

          <form onSubmit={handleVerifyPassword} style={{ width: '100%', textAlign: 'left' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="classroom-passcode-input"
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#475569',
                  marginBottom: '0.5rem',
                  letterSpacing: '0.01em',
                }}
              >
                Passcode
              </label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={18} style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: passwordError ? '#ef4444' : '#94a3b8',
                  pointerEvents: 'none',
                }} />
                <input
                  id="classroom-passcode-input"
                  type="password"
                  value={enteredPassword}
                  onChange={e => { setEnteredPassword(e.target.value); if (passwordError) setPasswordError('') }}
                  placeholder="Enter classroom passcode"
                  style={{
                    width: '100%',
                    paddingLeft: '2.75rem',
                    paddingRight: '1rem',
                    paddingTop: '0.8125rem',
                    paddingBottom: '0.8125rem',
                    borderRadius: '0.75rem',
                    border: `1.5px solid ${passwordError ? '#fca5a5' : '#cbd5e1'}`,
                    background: passwordError ? '#fff5f5' : '#f8fafc',
                    fontSize: '0.9375rem',
                    color: '#1e293b',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 200ms',
                  }}
                />
              </div>
              {passwordError && (
                <p style={{
                  fontSize: '0.8rem',
                  color: '#ef4444',
                  marginTop: '0.4rem',
                  margin: '0.4rem 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}>
                  <AlertCircle size={13} /> {passwordError}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={verifyingPassword || !enteredPassword.trim()}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  background: enteredPassword.trim()
                    ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                    : '#cbd5e1',
                  color: enteredPassword.trim() ? '#fff' : '#94a3b8',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: enteredPassword.trim() && !verifyingPassword ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: enteredPassword.trim() ? '0 4px 14px rgba(37,99,235,0.25)' : 'none',
                  transition: 'all 200ms',
                }}
              >
                {verifyingPassword ? 'Verifying...' : 'Verify & Join'}
              </button>

              <button
                type="button"
                onClick={handleBack}
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
                  transition: 'all 200ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // 4. Active Classroom Screen
  if (isJoined && roomId) {
    return (
      <Classroom
        key={`${roomId}-${displayName}`}
        roomId={roomId}
        role={role}
        displayName={displayName}
        password={password}
        localMedia={localMedia}
        onLeave={handleLeave}
        signalingUrl={getApiUrl()}
      />
    )
  }

  // 5. Pre-Join Screen (Lobby)
  return (
    <PreJoinScreen
      roomId={roomId || ''}
      role={role}
      displayName={displayName}
      onChangeName={navState?.displayName ? undefined : handleUpdateName}
      localMedia={localMedia}
      onJoin={handleJoin}
      onBack={handleBack}
    />
  )
}
