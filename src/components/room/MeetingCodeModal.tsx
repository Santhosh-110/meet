import { useState, useEffect, useCallback } from 'react'
import { X, Copy, Check, ArrowRight, Calendar, Share2, Link2 } from 'lucide-react'
import type { MeetingInfo } from '../../types/webrtc'

interface MeetingCodeModalProps {
  meeting: MeetingInfo
  onJoin: (roomId: string, meetingId: string) => void
  onClose: () => void
}

export function MeetingCodeModal({ meeting, onJoin, onClose }: MeetingCodeModalProps) {
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null)
  const [visible, setVisible] = useState(false)

  // Trigger entrance animation on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    // Wait for exit animation before unmounting
    setTimeout(onClose, 250)
  }, [onClose])

  const meetingLink = `${window.location.origin}/classroom/${meeting.meetingId}`

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(meeting.meetingId)
      setCopiedType('code')
      setTimeout(() => setCopiedType(null), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = meeting.meetingId
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedType('code')
      setTimeout(() => setCopiedType(null), 2000)
    }
  }, [meeting.meetingId])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(meetingLink)
      setCopiedType('link')
      setTimeout(() => setCopiedType(null), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = meetingLink
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedType('link')
      setTimeout(() => setCopiedType(null), 2000)
    }
  }, [meetingLink])

  const handleShare = useCallback(async () => {
    const shareData = {
      title: 'Join my LearnLink Classroom',
      text: `Join my virtual classroom on LearnLink. Code: ${meeting.meetingId}`,
      url: meetingLink,
    }

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        console.error('Web share failed, falling back to copy link:', err)
        handleCopyLink()
      }
    } else {
      handleCopyLink()
    }
  }, [meeting.meetingId, meetingLink, handleCopyLink])

  const handleJoin = useCallback(() => {
    onJoin(meeting.roomId, meeting.meetingId)
  }, [onJoin, meeting.roomId, meeting.meetingId])

  // Format the creation date
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(meeting.createdAt))

  // Social share URLs
  const shareText = `Join my virtual classroom on LearnLink.`
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} Link: ${meetingLink}`)}`
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(meetingLink)}&text=${encodeURIComponent(shareText)}`
  const gmailUrl = `mailto:?subject=${encodeURIComponent('Join my LearnLink Classroom')}&body=${encodeURIComponent(`${shareText}\n\nClassroom Link: ${meetingLink}\nClassroom Code: ${meeting.meetingId}`)}`
  const smsUrl = `sms:?body=${encodeURIComponent(`${shareText} Link: ${meetingLink}`)}`

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)',
          zIndex: 50,
          opacity: visible ? 1 : 0,
          transition: 'opacity 250ms ease',
        }}
      />

      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 51,
          padding: '1rem',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '1.25rem',
            boxShadow: '0 25px 60px rgba(0,0,0,0.18)',
            width: '100%',
            maxWidth: '460px',
            padding: '2rem',
            pointerEvents: 'all',
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
            opacity: visible ? 1 : 0,
            transition: 'transform 280ms cubic-bezier(0.34,1.56,0.64,1), opacity 250ms ease',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <h2
                id="modal-title"
                style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', margin: 0 }}
              >
                Classroom created for later
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
                <Calendar size={13} style={{ color: '#94a3b8' }} />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Created {formattedDate}</span>
              </div>
            </div>
            <button
              onClick={handleClose}
              id="modal-close-btn"
              aria-label="Close modal"
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '50%',
                border: 'none',
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#e2e8f0')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f1f5f9')}
            >
              <X size={16} style={{ color: '#64748b' }} />
            </button>
          </div>

          {/* Description */}
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Share the classroom link below with students so they can join the virtual classroom directly.
          </p>

          {/* Meeting details display container */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* Meeting Link Section */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.75rem',
              padding: '1rem',
              position: 'relative',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Link2 size={14} style={{ color: '#2563eb' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Classroom Link</span>
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
                }}>{meetingLink}</span>
                <button
                  onClick={handleCopyLink}
                  aria-label="Copy classroom link"
                  style={{
                    padding: '0.35rem 0.625rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #cbd5e1',
                    background: copiedType === 'link' ? '#f0fdf4' : '#fff',
                    color: copiedType === 'link' ? '#16a34a' : '#1e293b',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    transition: 'all 150ms',
                  }}
                >
                  {copiedType === 'link' ? <Check size={12} /> : <Copy size={12} />}
                  {copiedType === 'link' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Meeting Code Section */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.75rem',
              padding: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <ArrowRight size={14} style={{ color: '#16a34a' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Classroom Code</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: '#1e293b',
                  fontFamily: "'Courier New', Courier, monospace",
                  letterSpacing: '0.05em',
                }}>{meeting.meetingId}</span>
                <button
                  onClick={handleCopyCode}
                  aria-label="Copy classroom code"
                  style={{
                    padding: '0.35rem 0.625rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #cbd5e1',
                    background: copiedType === 'code' ? '#f0fdf4' : '#fff',
                    color: copiedType === 'code' ? '#16a34a' : '#1e293b',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    transition: 'all 150ms',
                  }}
                >
                  {copiedType === 'code' ? <Check size={12} /> : <Copy size={12} />}
                  {copiedType === 'code' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Social Share Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Share Link Via</span>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              {/* WhatsApp */}
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" title="Share via WhatsApp" style={{
                width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 150ms'
              }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                  <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 0 0 1.333 4.982L2 22l5.202-1.362a9.927 9.927 0 0 0 4.805 1.232h.005c5.505 0 9.99-4.476 9.99-9.983C22 5.907 17.518 2 12.012 2zm6.368 14.26c-.282.793-1.42 1.442-1.959 1.493-.49.046-1.127.082-3.267-.803-2.738-1.13-4.502-3.922-4.638-4.103-.137-.182-1.112-1.478-1.112-2.819 0-1.34.704-2.001.954-2.27.25-.268.55-.335.733-.335.183 0 .367.004.527.012.169.008.398-.065.623.473.23.55.787 1.919.856 2.057.069.138.115.298.023.482-.092.184-.138.299-.275.459-.138.16-.29.356-.413.478-.137.138-.282.288-.122.563.16.275.713 1.177 1.53 1.905.818.728 1.506.953 1.72.1.213-.854.458-1.128.618-1.192.161-.065.32-.05.62.065.3.115 1.906.9 2.152 1.023.246.123.411.184.47.288.058.104.058.604-.224 1.397z"/>
                </svg>
              </a>

              {/* Telegram */}
              <a href={telegramUrl} target="_blank" rel="noopener noreferrer" title="Share via Telegram" style={{
                width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: '#0088cc', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 150ms'
              }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.58.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.2-.01-.1.02-1.62 1.03-4.58 3.03-.43.3-.83.45-1.18.44-.4-.01-1.16-.23-1.72-.41-.7-.23-1.25-.35-1.2-.74.03-.2.3-.41.82-.62 3.2-1.39 5.34-2.31 6.42-2.76 3.07-1.28 3.7-1.5 4.13-1.51.09 0 .3.02.43.13.11.09.15.22.16.33z"/>
                </svg>
              </a>

              {/* Gmail */}
              <a href={gmailUrl} title="Share via Gmail" style={{
                width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: '#ea4335', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 150ms'
              }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </a>

              {/* SMS */}
              <a href={smsUrl} title="Share via SMS" style={{
                width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 150ms'
              }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Success messages */}
          <div style={{ minHeight: '1.5rem', marginBottom: '1rem', textAlign: 'center' }}>
            {copiedType && (
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  margin: 0,
                  animation: 'fadeIn 150ms ease',
                }}
              >
                <Check size={14} />
                {copiedType === 'link' ? 'Classroom link copied successfully.' : 'Classroom code copied successfully.'}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Share button */}
            <button
              id="share-meeting-btn"
              onClick={handleShare}
              style={{
                width: '100%',
                padding: '0.875rem',
                borderRadius: '0.75rem',
                border: '1.5px solid #bfdbfe',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 600,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#dbeafe')}
              onMouseLeave={e => (e.currentTarget.style.background = '#eff6ff')}
            >
              <Share2 size={18} />
              Share Meeting Link
            </button>

            {/* Join now button */}
            <button
              id="modal-join-btn"
              onClick={handleJoin}
              style={{
                width: '100%',
                padding: '0.875rem',
                borderRadius: '0.75rem',
                border: 'none',
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,0.45)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,0.35)')}
            >
              <ArrowRight size={18} />
              Join Now
            </button>

            {/* Close / done button */}
            <button
              id="modal-done-btn"
              onClick={handleClose}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.75rem',
                border: '1.5px solid #e2e8f0',
                background: 'transparent',
                color: '#64748b',
                fontWeight: 500,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Done
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
