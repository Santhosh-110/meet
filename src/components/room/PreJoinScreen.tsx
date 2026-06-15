import { useState, useEffect, useRef, useCallback } from 'react'
import { Video, VideoOff, Mic, MicOff, Copy, Check, ArrowLeft, Settings, Volume2 } from 'lucide-react'
import { useClassroomStore } from '../../stores/classroomStore'

interface PreJoinScreenProps {
  roomId: string
  role: 'teacher' | 'student'
  displayName: string
  onChangeName?: (name: string) => void
  localMedia: {
    stream: MediaStream | null
    videoTrack: MediaStreamTrack | null
    audioTrack: MediaStreamTrack | null
    startMedia: (videoDeviceId?: string, audioDeviceId?: string) => Promise<MediaStream>
    stopMedia: () => void
    toggleVideo: () => Promise<void>
    toggleAudio: () => Promise<void>
    error: string | null
    clearError: () => void
  }
  onJoin: () => void
  onBack: () => void
}

export function PreJoinScreen({
  roomId,
  role,
  displayName,
  onChangeName,
  localMedia,
  onJoin,
  onBack,
}: PreJoinScreenProps) {
  const [copied, setCopied] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedVideoId, setSelectedVideoId] = useState<string>('')
  const [selectedAudioId, setSelectedAudioId] = useState<string>('')
  const [showSettings, setShowSettings] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  // Live clock — ticks every second
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  
  const videoRef = useRef<HTMLVideoElement>(null)

  // Enumerate devices and request initial access
  useEffect(() => {
    let active = true

    async function initLobby() {
      try {
        setPermissionError(null)
        // Request camera and microphone access
        await localMedia.startMedia()
        
        if (!active) return

        // Once access is granted, list devices
        const allDevices = await navigator.mediaDevices.enumerateDevices()
        if (!active) return

        setDevices(allDevices)
        
        const video = allDevices.filter(d => d.kind === 'videoinput')
        const audio = allDevices.filter(d => d.kind === 'audioinput')
        
        setVideoDevices(video)
        setAudioDevices(audio)

        // Find current tracks and match them
        const stream = localMedia.stream
        if (stream) {
          const activeVideoTrack = stream.getVideoTracks()[0]
          const activeAudioTrack = stream.getAudioTracks()[0]
          
          if (activeVideoTrack) {
            const settings = activeVideoTrack.getSettings()
            if (settings.deviceId) setSelectedVideoId(settings.deviceId)
          } else if (video.length > 0) {
            setSelectedVideoId(video[0].deviceId)
          }

          if (activeAudioTrack) {
            const settings = activeAudioTrack.getSettings()
            if (settings.deviceId) setSelectedAudioId(settings.deviceId)
          } else if (audio.length > 0) {
            setSelectedAudioId(audio[0].deviceId)
          }
        }
      } catch (err: any) {
        console.error('Failed to access media devices:', err)
        setPermissionError(err.message || 'Could not access camera/microphone.')
      }
    }

    initLobby()

    return () => {
      active = false
    }
  }, [])

  // Bind video element to the stream
  useEffect(() => {
    if (videoRef.current && localMedia.stream) {
      videoRef.current.srcObject = localMedia.stream
    }
  }, [localMedia.stream])

  // Handle device change
  const handleVideoDeviceChange = useCallback(async (deviceId: string) => {
    setSelectedVideoId(deviceId)
    try {
      await localMedia.startMedia(deviceId, selectedAudioId)
    } catch (err) {
      console.error('Failed to switch video source:', err)
    }
  }, [localMedia, selectedAudioId])

  const handleAudioDeviceChange = useCallback(async (deviceId: string) => {
    setSelectedAudioId(deviceId)
    try {
      await localMedia.startMedia(selectedVideoId, deviceId)
    } catch (err) {
      console.error('Failed to switch audio source:', err)
    }
  }, [localMedia, selectedVideoId])

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = roomId
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [roomId])

  const mediaState = useClassroomStore(state => state.mediaState)
  const setMediaState = useClassroomStore(state => state.setMediaState)

  const handleToggleAudio = useCallback(async () => {
    await localMedia.toggleAudio()
    const nextState = mediaState.audio === 'enabled' ? 'disabled' : 'enabled'
    setMediaState('audio', nextState)
  }, [localMedia, mediaState.audio, setMediaState])

  const handleToggleVideo = useCallback(async () => {
    await localMedia.toggleVideo()
    const nextState = mediaState.video === 'enabled' ? 'disabled' : 'enabled'
    setMediaState('video', nextState)
  }, [localMedia, mediaState.video, setMediaState])

  const isVideoOn = mediaState.video === 'enabled'
  const isAudioOn = mediaState.audio === 'enabled'

  const getInitials = (name: string) => {
    return name
      .trim()
      .split(/\s+/)
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#fff',
      fontFamily: "'Google Sans', 'Inter', sans-serif",
      color: '#1f1f1f',
    }}>
      {/* Top Header / Bar */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #f1f5f9',
      }}>
        <div
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}
          title="Back to home"
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 9L11 13.5V18C11 23.052 14.948 27.414 20 28.5C25.052 27.414 29 23.052 29 18V13.5L20 9Z" stroke="#1a73e8" strokeWidth="2.5" fill="none"/>
            <circle cx="20" cy="16" r="3" fill="#1a73e8"/>
            <path d="M13 20V24C13 26.761 16.239 29 19 29H21C23.761 29 27 26.761 27 24V20" stroke="#1a73e8" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          </svg>
          <span style={{ fontSize: '1.375rem', fontWeight: 500, color: '#1e293b', letterSpacing: '-0.01em' }}>LearnLink</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Live Clock */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
            <span style={{
              fontSize: '1.0625rem',
              fontWeight: 600,
              color: '#1e293b',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.01em',
              lineHeight: 1.2,
            }}>
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span style={{
              fontSize: '0.6875rem',
              color: '#64748b',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}>
              {now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div style={{ width: '1px', height: '2rem', background: '#e2e8f0' }} />
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              background: '#fff',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#64748b',
              cursor: 'pointer',
              transition: 'background 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            <ArrowLeft size={16} />
            Back to Home
          </button>
        </div>
      </header>

      {/* Lobby main content */}
      <main style={{
        flex: 1,
        maxWidth: '1120px',
        width: '100%',
        margin: '0 auto',
        padding: '3rem 1.5rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '4rem',
        alignItems: 'center',
      }}>
        {/* Left column: Video preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: '1.25rem',
            background: '#111827',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {localMedia.error || permissionError ? (
              <div style={{ color: '#fff', textAlign: 'center', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <VideoOff size={48} style={{ color: '#ea4335' }} />
                <p style={{ fontWeight: 600, fontSize: '1rem', margin: 0 }}>Camera Blocked</p>
                <p style={{ fontSize: '0.8125rem', color: '#9ca3af', maxWidth: '280px', margin: 0, lineHeight: 1.5 }}>
                  {localMedia.error || permissionError}
                </p>
                <button
                  onClick={async () => {
                    setPermissionError(null)
                    localMedia.clearError()
                    try {
                      await localMedia.startMedia()
                    } catch (_) {}
                  }}
                  style={{
                    marginTop: '0.25rem',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '2rem',
                    border: 'none',
                    background: '#1a73e8',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  ↺ Retry
                </button>
              </div>
            ) : isVideoOn && localMedia.stream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)', // mirror local preview
                }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '5rem',
                  height: '5rem',
                  borderRadius: '50%',
                  background: '#374151',
                  color: '#fff',
                  fontSize: '2rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {getInitials(displayName)}
                </div>
                <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Camera is off</p>
              </div>
            )}

            {/* Hovering Media Controls */}
            <div style={{
              position: 'absolute',
              bottom: '1rem',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '0.75rem',
              zIndex: 10,
            }}>
              {/* Mic toggle */}
              <button
                onClick={handleToggleAudio}
                aria-label={isAudioOn ? 'Mute microphone' : 'Unmute microphone'}
                style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '50%',
                  border: 'none',
                  background: isAudioOn ? 'rgba(255,255,255,0.2)' : '#ea4335',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(8px)',
                  transition: 'background 150ms, transform 100ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {isAudioOn ? <Mic size={20} /> : <MicOff size={20} />}
              </button>

              {/* Cam toggle */}
              <button
                onClick={handleToggleVideo}
                aria-label={isVideoOn ? 'Turn camera off' : 'Turn camera on'}
                style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '50%',
                  border: 'none',
                  background: isVideoOn ? 'rgba(255,255,255,0.2)' : '#ea4335',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(8px)',
                  transition: 'background 150ms, transform 100ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Right column: Action card / Join instructions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 400, color: '#1f1f1f', margin: '0 0 0.5rem' }}>
              Ready to join?
            </h1>
            {onChangeName ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                <label htmlFor="lobby-name-input" style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>
                  Your Name <span style={{ color: '#ea4335' }}>*</span>
                </label>
                <input
                  id="lobby-name-input"
                  type="text"
                  value={displayName}
                  onChange={e => onChangeName(e.target.value)}
                  placeholder="Enter your name to join"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.9375rem',
                    outline: 'none',
                    background: '#f8fafc',
                    color: '#1e293b',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ) : (
              <p style={{ color: '#5f6368', fontSize: '0.9375rem', margin: 0 }}>
                You are joining as <strong style={{ color: '#1f1f1f' }}>{displayName}</strong> ({role})
              </p>
            )}
          </div>

          {/* Meeting details */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '0.875rem',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Meeting Details
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <span style={{
                fontFamily: "'Courier New', Courier, monospace",
                fontWeight: 700,
                fontSize: '1.125rem',
                color: '#1e293b',
              }}>{roomId}</span>
              <button
                onClick={handleCopyCode}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5e1',
                  background: copied ? '#f0fdf4' : '#fff',
                  color: copied ? '#16a34a' : '#1d4ed8',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 150ms',
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy Code'}
              </button>
            </div>
          </div>

          {/* Device Settings Dropdowns */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                border: 'none',
                background: 'none',
                color: '#1a73e8',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                padding: 0,
                alignSelf: 'flex-start',
              }}
            >
              <Settings size={16} />
              {showSettings ? 'Hide device settings' : 'Check audio and video settings'}
            </button>

            {showSettings && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                padding: '1rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.875rem',
                animation: 'slideDown 200ms ease-out',
              }}>
                <div>
                  <label htmlFor="video-input-select" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                    Camera
                  </label>
                  <select
                    id="video-input-select"
                    value={selectedVideoId}
                    onChange={e => handleVideoDeviceChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.875rem',
                      background: '#fff',
                      outline: 'none',
                    }}
                  >
                    {videoDevices.length > 0 ? (
                      videoDevices.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                        </option>
                      ))
                    ) : (
                      <option value="">No cameras found</option>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="audio-input-select" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                    Microphone
                  </label>
                  <select
                    id="audio-input-select"
                    value={selectedAudioId}
                    onChange={e => handleAudioDeviceChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.875rem',
                      background: '#fff',
                      outline: 'none',
                    }}
                  >
                    {audioDevices.length > 0 ? (
                      audioDevices.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                        </option>
                      ))
                    ) : (
                      <option value="">No microphones found</option>
                    )}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Join Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={onJoin}
              disabled={!displayName.trim()}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: 'none',
                background: displayName.trim()
                  ? 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)'
                  : '#cbd5e1',
                color: displayName.trim() ? '#fff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: displayName.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: displayName.trim() ? '0 4px 14px rgba(26,115,232,0.3)' : 'none',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={e => displayName.trim() && (e.currentTarget.style.boxShadow = '0 6px 20px rgba(26,115,232,0.48)')}
              onMouseLeave={e => displayName.trim() && (e.currentTarget.style.boxShadow = '0 4px 14px rgba(26,115,232,0.3)')}
            >
              Join Now
            </button>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
