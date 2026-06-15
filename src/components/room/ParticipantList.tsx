import { Mic, MicOff, Crown, X, Video, VideoOff, Trash2 } from 'lucide-react'
import { useClassroomStore } from '../../stores/classroomStore'
import { AudioBars } from '../video/AudioBars'

interface ParticipantListProps {
  remoteConsumers: any[]
  onMuteAll: () => void
  onMutePeer: (peerId: string) => void
  onKickPeer: (peerId: string) => void
  onClose: () => void
}

export function ParticipantList({
  remoteConsumers,
  onMuteAll,
  onMutePeer,
  onKickPeer,
  onClose,
}: ParticipantListProps) {
  const peers = useClassroomStore(state => state.peers)
  const activeSpeaker = useClassroomStore(state => state.activeSpeaker)
  const raisedHands = useClassroomStore(state => state.raisedHands)
  const localPeerId = useClassroomStore(state => state.peerId)
  const localDisplayName = useClassroomStore(state => state.displayName)
  const localRole = useClassroomStore(state => state.role)
  const mediaState = useClassroomStore(state => state.mediaState)

  const allParticipants = [
    {
      peerId: localPeerId || 'local',
      displayName: localDisplayName || 'You',
      role: localRole || 'student',
      isLocal: true,
    },
    ...peers.map(p => ({
      peerId: p.peerId,
      displayName: p.displayName,
      role: p.role,
      isLocal: false,
    }))
  ]

  const isTeacher = localRole === 'teacher'

  const getInitials = (name: string) => {
    return name
      .trim()
      .split(/\s+/)
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <div style={{
      width: '360px',
      height: '100%',
      background: '#1e293b', // Dark theme sidebar
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
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
          People ({allParticipants.length})
        </h2>
        <button
          onClick={onClose}
          aria-label="Close panel"
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

      {/* Teacher Host Controls */}
      {isTeacher && allParticipants.length > 1 && (
        <div style={{
          padding: '1rem 1.5rem',
          background: '#0f172a',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 500 }}>Host Controls</span>
          <button
            onClick={onMuteAll}
            style={{
              padding: '0.5rem 0.875rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#ea4335',
              color: '#fff',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(234,67,53,0.25)',
              transition: 'background 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#dc2626')}
            onMouseLeave={e => (e.currentTarget.style.background = '#ea4335')}
          >
            Mute All
          </button>
        </div>
      )}

      {/* List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}>
        {allParticipants.map((peer) => {
          // Determine media states
          let videoEnabled = false
          let audioEnabled = false

          if (peer.isLocal) {
            videoEnabled = mediaState.video === 'enabled'
            audioEnabled = mediaState.audio === 'enabled'
          } else {
            // Find active consumers
            videoEnabled = remoteConsumers.some(c => c.peerId === peer.peerId && c.kind === 'video')
            audioEnabled = remoteConsumers.some(c => c.peerId === peer.peerId && c.kind === 'audio')
          }

          const isSpeaking = !peer.isLocal && activeSpeaker?.peerId === peer.peerId
          const isHandRaised = !!raisedHands[peer.peerId]

          return (
            <div
              key={peer.peerId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                background: isSpeaking ? '#1e293b' : 'transparent',
                border: isSpeaking ? '1px solid #3b82f6' : '1px solid transparent',
                transition: 'all 200ms ease',
              }}
            >
              {/* Initials Avatar */}
              <div style={{
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: '50%',
                background: peer.role === 'teacher' ? '#d97706' : '#475569',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {getInitials(peer.displayName)}
              </div>

              {/* Identity & Status */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#f8fafc',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {peer.displayName}
                  </span>
                  {peer.role === 'teacher' && (
                    <Crown size={13} style={{ color: '#fbbf24', flexShrink: 0 }} />
                  )}
                </div>
                {peer.isLocal && (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>(You)</span>
                )}
              </div>

              {/* Host Specific Controls */}
              {isTeacher && !peer.isLocal && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                  {/* Mute specific peer */}
                  {audioEnabled && (
                    <button
                      onClick={() => onMutePeer(peer.peerId)}
                      title="Mute participant"
                      style={{
                        background: '#334155',
                        border: 'none',
                        color: '#cbd5e1',
                        cursor: 'pointer',
                        padding: '0.3rem',
                        borderRadius: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 150ms',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#475569')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#334155')}
                    >
                      <MicOff size={13} />
                    </button>
                  )}
                  {/* Remove/kick specific peer */}
                  <button
                    onClick={() => onKickPeer(peer.peerId)}
                    title="Remove participant"
                    style={{
                      background: '#ea4335',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      padding: '0.3rem',
                      borderRadius: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#dc2626')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#ea4335')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}

              {/* Status Icons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
                {isHandRaised && (
                  <span style={{
                    fontSize: '1rem',
                    animation: 'bounceHand 1s infinite alternate',
                  }}>✋</span>
                )}
                
                {/* Audio mic status */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  minWidth: '28px',
                  height: '26px',
                  justifyContent: 'center',
                  background: audioEnabled && isSpeaking ? 'rgba(59,130,246,0.15)' : 'transparent',
                  borderRadius: '6px',
                  padding: '0 4px',
                  transition: 'background 200ms',
                }}>
                  {audioEnabled ? (
                    isSpeaking ? (
                      <AudioBars
                        level={75}
                        isSpeaking={true}
                        size="md"
                        colour={peer.isLocal ? 'bg-green-400' : 'bg-blue-400'}
                      />
                    ) : (
                      <Mic size={16} style={{ color: '#64748b' }} />
                    )
                  ) : (
                    <MicOff size={16} style={{ color: '#f87171' }} />
                  )}
                </div>

                {/* Video camera status */}
                <div style={{ display: 'flex', alignItems: 'center', height: '26px', justifyContent: 'center' }}>
                  {videoEnabled ? (
                    <Video size={16} style={{ color: '#64748b' }} />
                  ) : (
                    <VideoOff size={16} style={{ color: '#f87171' }} />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes bounceHand {
          from { transform: translateY(0); }
          to   { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  )
}