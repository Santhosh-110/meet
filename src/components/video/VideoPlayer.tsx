import { useEffect, useRef, useState } from 'react'
import { User } from 'lucide-react'

interface VideoPlayerProps {
  stream: MediaStream | null
  muted?: boolean
  mirrored?: boolean
  className?: string
  displayName?: string
}

export function VideoPlayer({
  stream,
  muted = false,
  mirrored = false,
  className = '',
  displayName
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      setIsLoading(true)
      setHasError(false)
    }
  }, [stream])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted
    }
  }, [muted])

  const handleLoadedData = () => {
    setIsLoading(false)
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  const getInitials = (name?: string) => {
    if (!name) return '?'
    return name
      .trim()
      .split(/\s+/)
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  const renderPlaceholder = () => (
    <div className={`w-full h-full bg-slate-900 flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white text-2xl font-semibold shadow-md">
          {displayName ? getInitials(displayName) : <User className="w-10 h-10 text-slate-400" />}
        </div>
        {displayName && (
          <span className="text-sm text-slate-300 font-medium tracking-wide">{displayName}</span>
        )}
      </div>
    </div>
  )

  if (!stream) {
    return renderPlaceholder()
  }

  return (
    <div className={`relative w-full h-full bg-slate-950 overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
          <div className="w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}
      
      {hasError && renderPlaceholder()}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        onLoadedData={handleLoadedData}
        onError={handleError}
        className={`w-full h-full object-cover ${mirrored ? 'scale-x-[-1]' : ''} ${isLoading || hasError ? 'hidden' : ''}`}
      />
    </div>
  )
}