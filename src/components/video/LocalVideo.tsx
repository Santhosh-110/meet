import { Mic, MicOff, Hand } from 'lucide-react'
import { VideoPlayer } from './VideoPlayer'
import { AudioBars } from './AudioBars'
import { useAudioLevel } from '../../hooks/useAudioLevel'
import { useClassroomStore } from '../../stores/classroomStore'

interface LocalVideoProps {
  stream: MediaStream | null
  muted?: boolean
}

export function LocalVideo({ stream, muted = true }: LocalVideoProps) {
  const localPeerId = useClassroomStore(state => state.peerId)
  const displayName = useClassroomStore(state => state.displayName) || 'You'
  const raisedHands = useClassroomStore(state => state.raisedHands)
  const isHandRaised = localPeerId ? !!raisedHands[localPeerId] : false
  const mediaState = useClassroomStore(state => state.mediaState)

  const isAudioMuted = mediaState.audio !== 'enabled'
  const isVideoOff = mediaState.video !== 'enabled'

  // Real-time audio level from the local microphone stream
  const { level, isSpeaking } = useAudioLevel(stream, !isAudioMuted)

  return (
    <div className={`relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-xl border transition-all duration-200 ${
      isSpeaking && !isAudioMuted
        ? 'border-green-500 shadow-[0_0_16px_rgba(34,197,94,0.45)]'
        : 'border-slate-800'
    }`}>
      <VideoPlayer stream={isVideoOff ? null : stream} muted={muted} mirrored displayName={displayName} />

      {/* Name Label & Mic State */}
      <div className="absolute bottom-3 left-3 z-10 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-md flex items-center gap-2 max-w-[85%]">
        {isHandRaised && (
          <Hand size={12} className="text-green-500 fill-current flex-shrink-0 animate-pulse" />
        )}
        <span className="text-white text-xs font-semibold tracking-wide truncate">{displayName} (You)</span>

        {isAudioMuted ? (
          <MicOff size={12} className="text-red-400 flex-shrink-0" />
        ) : isSpeaking ? (
          <AudioBars level={level} isSpeaking={isSpeaking} size="sm" colour="bg-green-400" />
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