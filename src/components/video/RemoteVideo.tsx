import { Mic, MicOff, Crown, Hand } from 'lucide-react'
import { VideoPlayer } from './VideoPlayer'
import { AudioBars } from './AudioBars'
import { useAudioLevel } from '../../hooks/useAudioLevel'
import { useClassroomStore } from '../../stores/classroomStore'

interface RemoteVideoProps {
  peerId: string
  displayName: string
  /** Combined stream that includes the remote audio track */
  stream: MediaStream | null
  /** Separate audio-only stream for level metering (if video/audio tracks split) */
  audioStream?: MediaStream | null
  isSpeaking?: boolean
  isTeacher?: boolean
  audioEnabled?: boolean
  videoEnabled?: boolean
}

export function RemoteVideo({
  peerId,
  displayName,
  stream,
  audioStream,
  isSpeaking: isSpeakingProp = false,
  isTeacher = false,
  audioEnabled = true,
  videoEnabled = true,
}: RemoteVideoProps) {
  const isHandRaised = !!useClassroomStore(state => state.raisedHands[peerId])

  // Use the dedicated audio stream for metering when available,
  // otherwise fall back to the combined stream
  const meterStream = audioStream ?? stream

  // Real-time audio level from the remote peer's audio track
  const { level, isSpeaking: localSpeaking } = useAudioLevel(meterStream, audioEnabled)

  // Combine server-side active-speaker flag with local measurement
  const isSpeaking = isSpeakingProp || localSpeaking

  return (
    <div className={`relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-xl border transition-all duration-200 ${
      isSpeaking && audioEnabled
        ? 'border-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.45)]'
        : 'border-slate-800'
    }`}>
      {videoEnabled && stream ? (
        <VideoPlayer stream={stream} muted={false} displayName={displayName} />
      ) : (
        <VideoPlayer stream={null} displayName={displayName} />
      )}

      {/* Label section (name, teacher indicator, mic status) */}
      <div className="absolute bottom-3 left-3 z-10 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-md flex items-center gap-2 max-w-[85%]">
        {isHandRaised && (
          <Hand size={12} className="text-green-500 fill-current flex-shrink-0 animate-pulse" />
        )}
        <span className="text-white text-xs font-semibold tracking-wide truncate">{displayName}</span>
        {isTeacher && (
          <Crown size={12} className="text-amber-400 flex-shrink-0" />
        )}
        {!audioEnabled ? (
          <MicOff size={12} className="text-red-400 flex-shrink-0" />
        ) : isSpeaking ? (
          <AudioBars level={level} isSpeaking={isSpeaking} size="sm" colour="bg-blue-400" />
        ) : (
          <Mic size={12} className="text-slate-400 flex-shrink-0" />
        )}
      </div>

      {/* Floating Hand Indicator */}
      {isHandRaised && (
        <div className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center shadow-lg border border-green-500/30 animate-bounce">
          <Hand size={16} className="fill-current text-white" />
        </div>
      )}
    </div>
  )
}