import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, PhoneOff } from 'lucide-react'

interface ControlBarProps {
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  onToggleAudio: () => void
  onToggleVideo: () => void
  onToggleScreenShare: () => void
  onLeave: () => void
  isTeacher?: boolean
}

export function ControlBar({
  audioEnabled,
  videoEnabled,
  screenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeave,
  isTeacher = false,
}: ControlBarProps) {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-4 bg-white border-t border-border-color shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <button
        onClick={onToggleAudio}
        className={`flex flex-col items-center gap-1 px-5 py-3 rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md ${
          audioEnabled
            ? 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            : 'bg-red-500 text-white'
        }`}
      >
        {audioEnabled ? <Mic size={22} /> : <MicOff size={22} />}
        <span className="text-[11px] font-medium">{audioEnabled ? 'Mic On' : 'Muted'}</span>
      </button>

      <button
        onClick={onToggleVideo}
        className={`flex flex-col items-center gap-1 px-5 py-3 rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md ${
          videoEnabled
            ? 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            : 'bg-red-500 text-white'
        }`}
      >
        {videoEnabled ? <Video size={22} /> : <VideoOff size={22} />}
        <span className="text-[11px] font-medium">{videoEnabled ? 'Camera On' : 'Off'}</span>
      </button>

      {isTeacher && (
        <button
          onClick={onToggleScreenShare}
          className={`flex flex-col items-center gap-1 px-5 py-3 rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md ${
            screenSharing
              ? 'bg-amber-500 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          {screenSharing ? <MonitorOff size={22} /> : <Monitor size={22} />}
          <span className="text-[11px] font-medium">{screenSharing ? 'Stop Share' : 'Share Screen'}</span>
        </button>
      )}

      <button
        onClick={onLeave}
        className="flex flex-col items-center gap-1 px-6 py-3 rounded-2xl bg-red-500 text-white transition-all duration-200 shadow-sm hover:shadow-md hover:bg-red-600"
      >
        <PhoneOff size={22} />
        <span className="text-[11px] font-medium">Leave</span>
      </button>
    </div>
  )
}