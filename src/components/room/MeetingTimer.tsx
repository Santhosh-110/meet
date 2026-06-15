import { useEffect, useState } from 'react'

interface MeetingTimerProps {
  startedAt: number | null
}

export function MeetingTimer({ startedAt }: MeetingTimerProps) {
  const [elapsed, setElapsed] = useState<number>(0)

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0)
      return
    }

    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000)
      setElapsed(seconds >= 0 ? seconds : 0)
    }, 1000)

    // Run immediately
    const initialSeconds = Math.floor((Date.now() - startedAt) / 1000)
    setElapsed(initialSeconds >= 0 ? initialSeconds : 0)

    return () => clearInterval(interval)
  }, [startedAt])

  if (!startedAt) return null

  const formatElapsed = (sec: number) => {
    const hrs = Math.floor(sec / 3600)
    const mins = Math.floor((sec % 3600) / 60)
    const secs = sec % 60

    const pad = (n: number) => n.toString().padStart(2, '0')

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    }
    return `${pad(mins)}:${pad(secs)}`
  }

  return (
    <span style={{
      fontSize: '0.875rem',
      fontWeight: 500,
      color: '#94a3b8',
      fontFamily: "monospace",
    }}>
      {formatElapsed(elapsed)}
    </span>
  )
}
