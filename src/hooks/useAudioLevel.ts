import { useEffect, useRef, useState } from 'react'

/**
 * useAudioLevel
 *
 * Analyses a MediaStream in real-time using the Web Audio API AnalyserNode.
 * Returns an audio level between 0 and 100 and an `isSpeaking` flag.
 *
 * @param stream  - The MediaStream to analyse (local or remote audio track).
 * @param enabled - Whether the audio track is currently active (not muted).
 */
export function useAudioLevel(
  stream: MediaStream | null,
  enabled: boolean = true
): { level: number; isSpeaking: boolean } {
  const [level, setLevel] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const rafRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  useEffect(() => {
    if (!stream || !enabled) {
      setLevel(0)
      setIsSpeaking(false)
      return
    }

    // Only proceed if there's at least one active audio track
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      setLevel(0)
      setIsSpeaking(false)
      return
    }

    let cancelled = false

    const setup = async () => {
      try {
        const ctx = new AudioContext()
        ctxRef.current = ctx

        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.6
        analyserRef.current = analyser

        const source = ctx.createMediaStreamSource(stream)
        sourceRef.current = source
        source.connect(analyser)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)

        const tick = () => {
          if (cancelled) return
          analyser.getByteTimeDomainData(dataArray)

          // RMS (root mean square) amplitude
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / dataArray.length)

          // Scale to 0–100 with a speech-tuned boost
          const scaled = Math.min(100, Math.round(rms * 400))

          setLevel(scaled)
          setIsSpeaking(scaled > 8) // threshold: above noise floor

          rafRef.current = requestAnimationFrame(tick)
        }

        tick()
      } catch {
        // AudioContext may be blocked; silently fail
      }
    }

    setup()

    return () => {
      cancelled = true
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      analyserRef.current?.disconnect()
      sourceRef.current?.disconnect()
      ctxRef.current?.close().catch(() => {})
      analyserRef.current = null
      sourceRef.current = null
      ctxRef.current = null
      setLevel(0)
      setIsSpeaking(false)
    }
  }, [stream, enabled])

  return { level, isSpeaking }
}
