import { useCallback, useEffect, useRef, useState } from 'react'

// Hook for managing local camera/mic capture
// getUserMedia is the browser API for accessing media devices
//
// Performance note: we start/stop tracks explicitly instead of
// always streaming, saving CPU/bandwidth when media is off

interface UseLocalMediaOptions {
  video?: boolean
  audio?: boolean
}

interface UseLocalMediaReturn {
  stream: MediaStream | null
  videoTrack: MediaStreamTrack | null
  audioTrack: MediaStreamTrack | null
  screenStream: MediaStream | null
  startMedia: (videoDeviceId?: string, audioDeviceId?: string) => Promise<MediaStream>
  stopMedia: () => void
  toggleVideo: () => Promise<void>
  toggleAudio: () => Promise<void>
  startScreenShare: () => Promise<MediaStream>
  stopScreenShare: () => void
  error: string | null
  clearError: () => void
}

export function useLocalMedia(
  options: UseLocalMediaOptions = { video: true, audio: true }
): UseLocalMediaReturn {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)

  const startMedia = useCallback(async (videoDeviceId?: string, audioDeviceId?: string): Promise<MediaStream> => {
    try {
      setError(null)

      // Stop existing tracks first and wait briefly so the OS has time
      // to fully release the hardware before we request it again.
      // This prevents "NotReadableError: Device in use" on re-entry.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setStream(null)
        await new Promise(r => setTimeout(r, 150))
      }

      const constraints: MediaStreamConstraints = {
        video: options.video ? {
          deviceId: videoDeviceId ? { exact: videoDeviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        } : false,
        audio: options.audio ? {
          deviceId: audioDeviceId ? { exact: audioDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } : false,
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = mediaStream
      setStream(mediaStream)
      return mediaStream
    } catch (err: any) {
      const msg =
        err.name === 'NotAllowedError'
          ? 'Camera/mic permission denied. Please allow access in your browser settings.'
          : err.name === 'NotFoundError'
            ? 'No camera or microphone found. Please connect a device and try again.'
            : err.name === 'NotReadableError' || err.message?.toLowerCase().includes('device in use')
              ? 'Camera is in use by another app or tab. Close other apps using the camera and click Retry.'
              : `Media error: ${err.message}`
      setError(msg)
      throw err
    }
  }, [options.video, options.audio])

  const stopMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setStream(null)
    }
  }, [])

  const toggleVideo = useCallback(async () => {
    if (!streamRef.current) return
    const videoTrack = streamRef.current.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      setStream(new MediaStream([...streamRef.current.getAudioTracks(), videoTrack]))
    }
  }, [])

  const toggleAudio = useCallback(async () => {
    if (!streamRef.current) return
    const audioTrack = streamRef.current.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      setStream(new MediaStream([...streamRef.current.getVideoTracks(), audioTrack]))
    }
  }, [])

  const startScreenShare = useCallback(async (): Promise<MediaStream> => {
    try {
      setError(null)
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      })
      screenStreamRef.current = mediaStream
      setScreenStream(mediaStream)

      // Handle user stopping share via browser UI
      mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare()
      })

      return mediaStream
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? 'Screen share permission denied'
        : `Screen share error: ${err.message}`
      setError(msg)
      throw err
    }
  }, [])

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop())
      screenStreamRef.current = null
      setScreenStream(null)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const videoTrack = stream?.getVideoTracks()[0] ?? null
  const audioTrack = stream?.getAudioTracks()[0] ?? null

  const clearError = useCallback(() => setError(null), [])

  return {
    stream,
    videoTrack,
    audioTrack,
    screenStream,
    startMedia,
    stopMedia,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    error,
    clearError,
  }
}
