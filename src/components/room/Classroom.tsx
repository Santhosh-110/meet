import { useEffect, useCallback, useState, useRef } from 'react'
import { Video, Mic, MicOff, VideoOff, Monitor, PhoneOff, Users, Hand, MessageSquare, Shield, Copy, Check, Share2, X } from 'lucide-react'
import { useClassroomStore } from '../../stores/classroomStore'
import { LocalVideo } from '../video/LocalVideo'
import { RemoteVideo } from '../video/RemoteVideo'
import { VideoGrid } from '../video/VideoGrid'
import { ParticipantList } from './ParticipantList'
import { ChatPanel } from './ChatPanel'
import { MeetingTimer } from './MeetingTimer'
import { JoinToast } from './JoinToast'
import { useMediasoup } from '../../hooks/useMediasoup'
import type { Role } from '../../types/webrtc'

interface ClassroomProps {
  roomId: string
  role: Role
  displayName: string
  password?: string
  localMedia: {
    stream: MediaStream | null
    videoTrack: MediaStreamTrack | null
    audioTrack: MediaStreamTrack | null
    startMedia: (videoDeviceId?: string, audioDeviceId?: string) => Promise<MediaStream>
    stopMedia: () => void
    toggleVideo: () => Promise<void>
    toggleAudio: () => Promise<void>
    startScreenShare: () => Promise<MediaStream>
    stopScreenShare: () => void
    screenStream: MediaStream | null
    error: string | null
  }
  onLeave: () => void
  signalingUrl?: string
}

export function Classroom({
  roomId,
  role,
  displayName,
  password,
  localMedia,
  onLeave,
  signalingUrl,
}: ClassroomProps) {
  const [sidebar, setSidebar] = useState<'none' | 'chat' | 'participants'>('none')
  const [copied, setCopied] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [showDetailsPopover, setShowDetailsPopover] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Live clock — ticks every second
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Social sharing parameters
  const shareText = `Join my virtual classroom on LearnLink.`
  const classroomUrl = `${window.location.origin}/classroom/${roomId}`
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} Link: ${classroomUrl}`)}`
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(classroomUrl)}&text=${encodeURIComponent(shareText)}`
  const gmailUrl = `mailto:?subject=${encodeURIComponent('Join my LearnLink Classroom')}&body=${encodeURIComponent(`${shareText}\n\nClassroom Link: ${classroomUrl}\nClassroom Code: ${roomId}`)}`
  const smsUrl = `sms:?body=${encodeURIComponent(`${shareText} Link: ${classroomUrl}`)}`

  const {
    peers,
    activeSpeaker,
    mediaState,
    setMediaState,
    setScreenShare,
    chatMessages,
    addChatMessage,
    raisedHands,
    meetingStartedAt,
    peerId: localPeerId,
  } = useClassroomStore()

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  const hostCallbacksRef = useRef({
    onHostMute: () => {},
    onHostKick: (reason?: string) => {}
  })

  hostCallbacksRef.current = {
    onHostMute: () => {
      if (mediaState.audio === 'enabled') {
        handleToggleAudio()
      }
    },
    onHostKick: (reason?: string) => {
      if (reason === 'meeting-ended') {
        alert('The host has ended the meeting.')
      } else {
        alert('You have been removed from the meeting by the host.')
      }
      leaveRoom()
      onLeave()
    }
  }

  const {
    joinRoom,
    leaveRoom,
    produceMedia,
    produceScreenShare,
    producers,
    remoteConsumers,
    initialized,
    error: mediasoupError,
    pauseAudioProducer,
    resumeAudioProducer,
    pauseVideoProducer,
    resumeVideoProducer,
    sendChatMessage,
    raiseHand,
    lowerHand,
    muteAllPeers,
    mutePeer,
    kickPeer,
    endMeeting, 
  } = useMediasoup({
    signalingUrl,
    onHostMute: () => hostCallbacksRef.current.onHostMute(),
    onHostKick: (reason) => hostCallbacksRef.current.onHostKick(reason),
  })

  const {
    stream: localStream,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
  } = localMedia

  // Handlers
  const handleToggleAudio = useCallback(async () => {
    const newState = mediaState.audio === 'enabled' ? 'disabled' : 'enabled'
    await toggleAudio()
    setMediaState('audio', newState)
    if (newState === 'disabled') {
      await pauseAudioProducer()
    } else {
      const activeAudioProducer = producers.find(p => p.track?.kind === 'audio')
      if (!activeAudioProducer && localStream) {
        const audioTrack = localStream.getAudioTracks()[0]
        if (audioTrack) {
          audioTrack.enabled = true
          await produceMedia('cam-audio', audioTrack)
        }
      } else {
        await resumeAudioProducer()
      }
    }
  }, [toggleAudio, setMediaState, mediaState.audio, pauseAudioProducer, resumeAudioProducer, producers, localStream, produceMedia])

  const handleToggleVideo = useCallback(async () => {
    const newState = mediaState.video === 'enabled' ? 'disabled' : 'enabled'
    await toggleVideo()
    setMediaState('video', newState)
    if (newState === 'disabled') {
      await pauseVideoProducer()
    } else {
      const activeVideoProducer = producers.find(p => p.track?.kind === 'video')
      if (!activeVideoProducer && localStream) {
        const videoTrack = localStream.getVideoTracks()[0]
        if (videoTrack) {
          videoTrack.enabled = true
          await produceMedia('cam-video', videoTrack)
        }
      } else {
        await resumeVideoProducer()
      }
    }
  }, [toggleVideo, setMediaState, mediaState.video, pauseVideoProducer, resumeVideoProducer, producers, localStream, produceMedia])

  const handleToggleScreenShare = useCallback(async () => {
    if (mediaState.screen) {
      stopScreenShare()
      setScreenShare(false)
    } else {
      try {
        const screenMedia = await startScreenShare()
        const videoTrack = screenMedia.getVideoTracks()[0]
        if (videoTrack) {
          await produceScreenShare(videoTrack)
          setScreenShare(true)
        }
      } catch (err) {
        console.error('Failed to start screen share:', err)
      }
    }
  }, [mediaState.screen, startScreenShare, stopScreenShare, produceScreenShare, setScreenShare])

  const handleToggleHand = useCallback(() => {
    if (!localPeerId) return
    const isHandRaised = !!raisedHands[localPeerId]
    if (isHandRaised) {
      lowerHand()
    } else {
      raiseHand(displayName)
    }
  }, [localPeerId, raisedHands, lowerHand, raiseHand, displayName])

  const handleSendMessage = useCallback((text: string) => {
    sendChatMessage(text, displayName)
    // Add locally for instant UI update
    addChatMessage({
      id: `local-${Date.now()}`,
      peerId: localPeerId || 'local',
      displayName,
      text,
      timestamp: Date.now(),
    })
  }, [sendChatMessage, displayName, addChatMessage, localPeerId])

  const handleCopyLink = useCallback(async () => {
    const meetingLink = `${window.location.origin}/classroom/${roomId}`
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
  }, [roomId])

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomId)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = roomId
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }, [roomId])

  const handleShare = useCallback(async () => {
    const meetingLink = `${window.location.origin}/classroom/${roomId}`
    const shareData = {
      title: 'Join my LearnLink Classroom',
      text: `Join my virtual classroom on LearnLink. Code: ${roomId}`,
      url: meetingLink,
    }

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        console.error('Web share failed, copying link:', err)
        handleCopyLink()
      }
    } else {
      handleCopyLink()
    }
  }, [roomId, handleCopyLink])

  useEffect(() => {
    if (!showDetailsPopover) return
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowDetailsPopover(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDetailsPopover])

  const handleLeave = useCallback(() => {
    if (role === 'teacher') {
      setShowLeaveConfirm(true)
    } else {
      leaveRoom()
      onLeave()
    }
  }, [role, leaveRoom, onLeave])

  const handleJustLeave = useCallback(() => {
    leaveRoom()
    onLeave()
  }, [leaveRoom, onLeave])

  const handleEndMeetingForEveryone = useCallback(() => {
    endMeeting()
    leaveRoom()
    onLeave()
  }, [endMeeting, leaveRoom, onLeave])

  // Initial Room Connect Lifecycle
  useEffect(() => {
    let active = true

    async function startRoom() {
      try {
        await joinRoom(roomId, role, displayName, password)
        if (!active) return

        // Wait brief instant and produce initial tracks if available
        if (localStream) {
          const videoTrack = localStream.getVideoTracks()[0]
          const audioTrack = localStream.getAudioTracks()[0]

          // Sync initial camera mute state
          if (videoTrack) {
            videoTrack.enabled = mediaState.video === 'enabled'
            if (mediaState.video === 'enabled') {
              await produceMedia('cam-video', videoTrack)
            }
          }

          // Sync initial audio mute state
          if (audioTrack) {
            audioTrack.enabled = mediaState.audio === 'enabled'
            if (mediaState.audio === 'enabled') {
              await produceMedia('cam-audio', audioTrack)
            }
          }
        }
      } catch (err) {
        console.error('Room startup failed:', err)
      }
    }

    startRoom()

    return () => {
      active = false
    }
  }, [])

  if (mediasoupError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center flex-col gap-5 p-6 text-white font-sans">
        <div className="w-20 h-20 rounded-full bg-red-950/50 border border-red-800 flex items-center justify-center">
          <VideoOff className="w-10 h-10 text-red-500 animate-pulse" />
        </div>
        <h2 className="text-2xl font-semibold tracking-wide">Lobby Connection Error</h2>
        <p className="text-slate-400 text-center max-w-md">{mediasoupError}</p>
        <button
          onClick={handleLeave}
          className="mt-2 px-8 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium shadow-lg transition-colors"
        >
          Return to Lobby
        </button>
      </div>
    )
  }

  const remoteVideoElements = remoteConsumers
    .filter((c) => c.kind === 'video')
    .map((consumer) => {
      const peer = peers.find((p) => p.peerId === consumer.peerId)
      const audioConsumer = remoteConsumers.find(
        (rc) => rc.peerId === consumer.peerId && rc.kind === 'audio'
      )
      const isPeerAudioEnabled = !!(audioConsumer && !audioConsumer.paused)
      // Build a dedicated audio-only stream for level metering
      const audioStream = audioConsumer?.track
        ? new MediaStream([audioConsumer.track])
        : null
      return (
        <RemoteVideo
          key={consumer.consumerId}
          peerId={consumer.peerId}
          displayName={peer?.displayName ?? 'Participant'}
          stream={consumer.track ? new MediaStream([consumer.track]) : null}
          audioStream={audioStream}
          isSpeaking={activeSpeaker?.peerId === consumer.peerId}
          isTeacher={peer?.role === 'teacher'}
          audioEnabled={isPeerAudioEnabled}
          videoEnabled={!consumer.paused}
        />
      )
    })

  const hasRemotePeers = remoteVideoElements.length > 0
  const isHandRaised = localPeerId ? !!raisedHands[localPeerId] : false

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white select-none font-sans overflow-hidden">
      {/* Sleek Google Meet Top Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900/50 border-b border-slate-800/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <div
            onClick={handleLeave}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            title="Leave and return to home"
          >
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 9L11 13.5V18C11 23.052 14.948 27.414 20 28.5C25.052 27.414 29 23.052 29 18V13.5L20 9Z" stroke="#3b82f6" strokeWidth="2.5" fill="none"/>
              <circle cx="20" cy="16" r="3" fill="#3b82f6"/>
              <path d="M13 20V24C13 26.761 16.239 29 19 29H21C23.761 29 27 26.761 27 24V20" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            </svg>
            <span className="text-sm font-semibold tracking-wide text-slate-200">LearnLink</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-slate-400 tracking-wider">{roomId}</span>
          </div>
          <button
            onClick={handleCopyLink}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            title="Copy Invite Link"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          </button>
          {copied && <span className="text-xs text-green-500 animate-fade">Link copied!</span>}
        </div>

        {/* Right: Live Clock + Meeting Timer + Badge */}
        <div className="flex items-center gap-3">
          {/* Live Date & Time */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-200 tabular-nums tracking-wide">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-[10px] text-slate-500 tracking-wider">
              {now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="w-px h-6 bg-slate-700 hidden sm:block" />
          <MeetingTimer startedAt={meetingStartedAt} />
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-950/40 rounded-full border border-blue-900/40 text-xs font-semibold text-blue-400">
            <Shield size={12} />
            <span>Secure WebRTC</span>
          </div>
        </div>
      </header>

      {/* Main Classroom Screen */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col relative bg-slate-950">
          
          {/* Main Grid View */}
          <div className="flex-1 flex items-center justify-center p-6 transition-all duration-300">
            {hasRemotePeers ? (
              <VideoGrid>{remoteVideoElements}</VideoGrid>
            ) : (
              /* If no remote peers, show local video filling the main space */
              <div className="max-w-[700px] w-full aspect-video shadow-2xl rounded-2xl overflow-hidden border border-slate-800">
                <LocalVideo stream={localStream} isSpeaking={false} muted />
              </div>
            )}
          </div>

          {/* Floating local PiP when others are present */}
          {hasRemotePeers && localStream && (
            <div className="absolute bottom-6 right-6 z-10 w-64 shadow-2xl rounded-xl overflow-hidden border border-slate-800/80 hover:scale-[1.02] transition-transform">
              <LocalVideo stream={localStream} isSpeaking={false} muted />
            </div>
          )}
        </div>

        {/* Slidable Drawers */}
        {sidebar === 'chat' && (
          <div className="h-full z-20 shadow-2xl animate-slide-left">
            <ChatPanel
              messages={chatMessages}
              localPeerId={localPeerId}
              localDisplayName={displayName}
              onSendMessage={handleSendMessage}
              onClose={() => setSidebar('none')}
            />
          </div>
        )}

        {sidebar === 'participants' && (
          <div className="h-full z-20 shadow-2xl animate-slide-left">
            <ParticipantList
              remoteConsumers={remoteConsumers}
              onMuteAll={muteAllPeers}
              onMutePeer={mutePeer}
              onKickPeer={kickPeer}
              onClose={() => setSidebar('none')}
            />
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="flex items-center justify-between px-8 py-5 bg-slate-900 border-t border-slate-800/80 z-20">
        
        {/* Left Side: Meeting details button */}
        <div className="w-1/4 hidden md:flex items-center gap-3 relative" ref={popoverRef}>
          <button
            onClick={() => setShowDetailsPopover(!showDetailsPopover)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showDetailsPopover 
                ? 'bg-slate-800 text-white border border-slate-700/50' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
            }`}
          >
            <span className="font-mono tracking-wider">{roomId}</span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${showDetailsPopover ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDetailsPopover && (
            <div className="absolute bottom-14 left-0 w-80 bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl p-4 flex flex-col gap-4 animate-slide-up z-30 backdrop-blur-md">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-200">Meeting details</h3>
                <button
                  onClick={() => setShowDetailsPopover(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {/* Meeting Link Section */}
                <div className="bg-slate-950/60 border border-slate-800/50 rounded-lg p-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Classroom Link</span>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-xs text-slate-300 truncate max-w-[170px]">{classroomUrl}</span>
                    <button
                      onClick={handleCopyLink}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold rounded transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check size={10} /> : <Copy size={10} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Meeting Code Section */}
                <div className="bg-slate-950/60 border border-slate-800/50 rounded-lg p-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Classroom Code</span>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-sm font-mono font-bold text-slate-300">{roomId}</span>
                    <button
                      onClick={handleCopyCode}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-semibold rounded border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCode ? <Check size={10} /> : <Copy size={10} />}
                      {copiedCode ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Social Share Grid */}
                <div className="flex flex-col gap-2 my-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Share Link Via</span>
                  <div className="flex gap-3 justify-center py-1">
                    {/* WhatsApp */}
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="w-8 h-8 rounded-full bg-[#25d366] flex items-center justify-center transition-transform hover:scale-110">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                        <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 0 0 1.333 4.982L2 22l5.202-1.362a9.927 9.927 0 0 0 4.805 1.232h.005c5.505 0 9.99-4.476 9.99-9.983C22 5.907 17.518 2 12.012 2zm6.368 14.26c-.282.793-1.42 1.442-1.959 1.493-.49.046-1.127.082-3.267-.803-2.738-1.13-4.502-3.922-4.638-4.103-.137-.182-1.112-1.478-1.112-2.819 0-1.34.704-2.001.954-2.27.25-.268.55-.335.733-.335.183 0 .367.004.527.012.169.008.398-.065.623.473.23.55.787 1.919.856 2.057.069.138.115.298.023.482-.092.184-.138.299-.275.459-.138.16-.29.356-.413.478-.137.138-.282.288-.122.563.16.275.713 1.177 1.53 1.905.818.728 1.506.953 1.72.1.213-.854.458-1.128.618-1.192.161-.065.32-.05.62.065.3.115 1.906.9 2.152 1.023.246.123.411.184.47.288.058.104.058.604-.224 1.397z"/>
                      </svg>
                    </a>
                    {/* Telegram */}
                    <a href={telegramUrl} target="_blank" rel="noopener noreferrer" title="Telegram" className="w-8 h-8 rounded-full bg-[#0088cc] flex items-center justify-center transition-transform hover:scale-110">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.58.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.2-.01-.1.02-1.62 1.03-4.58 3.03-.43.3-.83.45-1.18.44-.4-.01-1.16-.23-1.72-.41-.7-.23-1.25-.35-1.2-.74.03-.2.3-.41.82-.62 3.2-1.39 5.34-2.31 6.42-2.76 3.07-1.28 3.7-1.5 4.13-1.51.09 0 .3.02.43.13.11.09.15.22.16.33z"/>
                      </svg>
                    </a>
                    {/* Gmail */}
                    <a href={gmailUrl} title="Gmail" className="w-8 h-8 rounded-full bg-[#ea4335] flex items-center justify-center transition-transform hover:scale-110">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                    </a>
                    {/* SMS */}
                    <a href={smsUrl} title="SMS" className="w-8 h-8 rounded-full bg-[#475569] flex items-center justify-center transition-transform hover:scale-110">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>

              {/* Share Meeting Button */}
              <button
                onClick={handleShare}
                className="w-full py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Share2 size={14} />
                Share Classroom Link
              </button>
            </div>
          )}
        </div>

        {/* Center: Control Toggles */}
        <div className="flex items-center gap-3.5 justify-center flex-1">
          {/* Audio mic toggle */}
          <button
            onClick={handleToggleAudio}
            title={mediaState.audio === 'enabled' ? 'Mute Microphone' : 'Unmute Microphone'}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md ${
              mediaState.audio === 'enabled'
                ? 'bg-slate-800 text-white hover:bg-slate-700/80 border border-slate-700/50'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {mediaState.audio === 'enabled' ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          {/* Video camera toggle */}
          <button
            onClick={handleToggleVideo}
            title={mediaState.video === 'enabled' ? 'Turn Camera Off' : 'Turn Camera On'}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md ${
              mediaState.video === 'enabled'
                ? 'bg-slate-800 text-white hover:bg-slate-700/80 border border-slate-700/50'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {mediaState.video === 'enabled' ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          {/* Raise hand toggle */}
          <button
            onClick={handleToggleHand}
            title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md border ${
              isHandRaised
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-600 border-amber-400'
                : 'bg-slate-800 text-white hover:bg-slate-700/80 border-slate-700/50'
            }`}
          >
            <Hand size={20} className={isHandRaised ? 'fill-current' : ''} />
          </button>

          {/* Screen Share (Teacher only) */}
          {role === 'teacher' && (
            <button
              onClick={handleToggleScreenShare}
              title={mediaState.screen ? 'Stop Sharing' : 'Share Screen'}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md border ${
                mediaState.screen
                  ? 'bg-green-600 text-white hover:bg-green-700 border-green-500'
                  : 'bg-slate-800 text-white hover:bg-slate-700/80 border-slate-700/50'
              }`}
            >
              <Monitor size={20} />
            </button>
          )}

          {/* End Call / Leave Meeting */}
          <button
            onClick={handleLeave}
            title="Leave Meeting"
            className="w-14 h-12 rounded-3xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg hover:scale-105"
          >
            <PhoneOff size={20} />
          </button>
        </div>

        {/* Right Side: Drawer Toggles */}
        <div className="w-1/4 flex items-center justify-end gap-3">
          {/* Toggle participants sidebar */}
          <button
            onClick={() => setSidebar(sidebar === 'participants' ? 'none' : 'participants')}
            className={`p-2.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              sidebar === 'participants' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Users size={20} />
            <span className="text-xs font-semibold">{peers.length + 1}</span>
          </button>

          {/* Toggle chat sidebar */}
          <button
            onClick={() => setSidebar(sidebar === 'chat' ? 'none' : 'chat')}
            className={`p-2.5 rounded-lg transition-colors flex items-center relative ${
              sidebar === 'chat' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <MessageSquare size={20} />
            {chatMessages.length > 0 && sidebar !== 'chat' && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Floating Join/Leave toast triggers */}
      <JoinToast />

      {/* Leave Meeting Confirmation Modal */}
      {showLeaveConfirm && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowLeaveConfirm(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 transition-opacity duration-200"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md pointer-events-auto transform transition-all duration-300 animate-slide-up">
              <h2 className="text-lg font-semibold text-slate-100 mb-2">Leave call?</h2>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                Do you want to end this virtual classroom session for all students, or just leave the call yourself?
              </p>

              <div className="flex flex-col gap-3">
                {/* End call for everyone button */}
                <button
                  id="end-call-everyone-btn"
                  onClick={handleEndMeetingForEveryone}
                  className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 cursor-pointer animate-pulse"
                >
                  End call for everyone
                </button>

                {/* Just leave call button */}
                <button
                  id="just-leave-call-btn"
                  onClick={handleJustLeave}
                  className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700/60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  Just leave the call
                </button>

                {/* Return to call button */}
                <button
                  id="cancel-leave-btn"
                  onClick={() => setShowLeaveConfirm(false)}
                  className="w-full py-3 px-4 rounded-xl bg-transparent hover:bg-slate-800/40 text-slate-400 hover:text-slate-300 font-medium text-sm transition-colors mt-2 cursor-pointer"
                >
                  Return to call
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}