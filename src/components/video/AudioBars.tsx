/**
 * AudioBars
 *
 * Google Meet-style animated audio-level indicator.
 * Renders 4 vertical bars that animate in height based on the current
 * microphone volume ("bite") level (0–100).
 *
 * Size variants:
 *   xs   — tiny (video tile label area, 3px bars)
 *   sm   — small (general use, 4px bars)
 *   md   — medium (sidebar/participant list, 5px bars)
 *   lg   — large (featured speaker strip, 6px bars)
 */

interface AudioBarsProps {
  /** Current audio level 0–100 */
  level: number
  /** Whether the peer is actively speaking (above noise floor) */
  isSpeaking: boolean
  /** Visual size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Bar colour — Tailwind bg class */
  colour?: string
}

export function AudioBars({
  level,
  isSpeaking,
  size = 'sm',
  colour = 'bg-green-400',
}: AudioBarsProps) {
  const dim = {
    xs: { w: 3,  maxH: 12, gap: 2 },
    sm: { w: 4,  maxH: 16, gap: 2 },
    md: { w: 5,  maxH: 22, gap: 3 },
    lg: { w: 6,  maxH: 28, gap: 3 },
  }[size]

  // 4 bars — staggered multipliers give a natural waveform shape
  const multipliers = [0.55, 1.0, 0.75, 0.45]
  const minH = size === 'md' || size === 'lg' ? 5 : 3

  const bars = multipliers.map((m) =>
    isSpeaking
      ? Math.max(minH, Math.round((level * m * dim.maxH) / 100))
      : minH
  )

  return (
    <span
      aria-label={isSpeaking ? 'Speaking' : 'Microphone active'}
      style={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        gap: `${dim.gap}px`,
        height: `${dim.maxH}px`,
      }}
    >
      {bars.map((h, i) => (
        <span
          key={i}
          className={colour}
          style={{
            width: `${dim.w}px`,
            height: `${h}px`,
            borderRadius: '999px',
            display: 'block',
            transition: isSpeaking
              ? 'height 80ms ease-out'
              : 'height 200ms ease-in',
            willChange: 'height',
          }}
        />
      ))}
    </span>
  )
}
