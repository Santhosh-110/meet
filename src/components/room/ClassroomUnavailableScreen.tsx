import { useState, useRef, useEffect, useCallback } from 'react'
import { AlertCircle, ArrowLeft, Video, User, Users, VideoOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface ClassroomUnavailableScreenProps {
  roomId: string
  onBack: () => void
  reason?: 'not_found' | 'ended' | 'full'
}

export function ClassroomUnavailableScreen({ roomId, onBack, reason = 'not_found' }: ClassroomUnavailableScreenProps) {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [nameError, setNameError] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  // Generate Google Meet style meeting code: abc-defg-hij
  const generateMeetingCode = useCallback((): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyz'
    const rand = (len: number): string => {
      const bytes = new Uint8Array(len)
      crypto.getRandomValues(bytes)
      return Array.from(bytes, (b) => chars[b % chars.length]).join('')
    }
    return `${rand(3)}-${rand(4)}-${rand(3)}`
  }, [])

  const handleCreateNewMeeting = useCallback(() => {
    if (!displayName.trim()) {
      setNameError('Please enter your name to start a classroom.')
      nameInputRef.current?.focus()
      return
    }
    setNameError('')
    
    // Generate new code
    const newCode = generateMeetingCode()
    
    // Navigate to lobby of the new room as teacher
    navigate(`/classroom/${newCode}`, {
      state: {
        role: 'teacher',
        displayName: displayName.trim(),
        directJoin: false,
      },
      replace: true,
    })
  }, [displayName, generateMeetingCode, navigate])

  const nameFilled = displayName.trim().length > 0

  // Configure text/icon based on the unavailable reason
  const config = {
    title: 'Classroom Unavailable',
    description: 'This classroom is no longer available.',
    badgeBg: '#fee2e2',
    iconColor: '#ef4444',
    icon: <AlertCircle size={28} style={{ color: '#ef4444' }} />
  }

  if (reason === 'ended') {
    config.title = 'Classroom Ended'
    config.description = 'This classroom session has been ended by the host.'
    config.badgeBg = '#fee2e2'
    config.iconColor = '#ef4444'
    config.icon = <VideoOff size={26} style={{ color: '#ef4444' }} />
  } else if (reason === 'full') {
    config.title = 'Classroom Full'
    config.description = 'This classroom has reached its maximum capacity of 25 participants.'
    config.badgeBg = '#eff6ff'
    config.iconColor = '#2563eb'
    config.icon = <Users size={26} style={{ color: '#2563eb' }} />
  }

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
      {/* Container Card */}
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
        {/* Dynamic Badge Icon */}
        <div style={{
          width: '3.75rem',
          height: '3.75rem',
          borderRadius: '50%',
          background: config.badgeBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
        }}>
          {config.icon}
        </div>

        {/* Headings */}
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          color: '#0f172a',
          margin: '0 0 0.5rem',
          letterSpacing: '-0.015em',
        }}>{config.title}</h1>
        
        <p style={{
          fontSize: '0.9375rem',
          color: config.iconColor,
          fontWeight: 500,
          lineHeight: 1.6,
          margin: '0 0 2rem',
        }}>
          {config.description}
        </p>

        {/* Quick actions line */}
        <div style={{
          width: '100%',
          height: '1px',
          background: '#f1f5f9',
          margin: '0 0 1.75rem',
        }} />

        {/* Enter Name Form */}
        <div style={{ width: '100%', textAlign: 'left', marginBottom: '1.75rem' }}>
          <label
            htmlFor="not-found-name-input"
            style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#475569',
              marginBottom: '0.5rem',
              letterSpacing: '0.01em',
            }}
          >
            Your Name <span style={{ color: '#ef4444' }}>*</span>
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
              id="not-found-name-input"
              ref={nameInputRef}
              type="text"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); if (nameError) setNameError('') }}
              onKeyDown={e => e.key === 'Enter' && nameFilled && handleCreateNewMeeting()}
              placeholder="Enter your name to start a new classroom"
              style={{
                width: '100%',
                paddingLeft: '2.75rem',
                paddingRight: '1rem',
                paddingTop: '0.8125rem',
                paddingBottom: '0.8125rem',
                borderRadius: '0.75rem',
                border: `1.5px solid ${nameError ? '#fca5a5' : '#cbd5e1'}`,
                background: nameError ? '#fff5f5' : '#f8fafc',
                fontSize: '0.9375rem',
                color: '#1e293b',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 200ms',
              }}
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

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          width: '100%',
        }}>
          {/* Create New Meeting */}
          <button
            onClick={handleCreateNewMeeting}
            disabled={!nameFilled}
            style={{
              width: '100%',
              padding: '0.875rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: nameFilled
                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                : '#cbd5e1',
              color: nameFilled ? '#fff' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.9375rem',
              cursor: nameFilled ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: nameFilled ? '0 4px 14px rgba(37,99,235,0.25)' : 'none',
              transition: 'all 200ms',
            }}
          >
            <Video size={18} />
            Create New Classroom?
          </button>

          {/* Go Back to Home */}
          <button
            onClick={onBack}
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
            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            <ArrowLeft size={16} />
            Go to Home Screen
          </button>
        </div>
      </div>
    </div>
  )
}
