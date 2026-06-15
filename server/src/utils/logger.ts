// Simple logging utility for debugging WebRTC/mediasoup operations
// In production, replace with structured logging (winston, pino, etc.)

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error']
const CURRENT_LEVEL: LogLevel = 'debug'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_ORDER.indexOf(level) >= LOG_LEVEL_ORDER.indexOf(CURRENT_LEVEL)
}

function formatTimestamp(): string {
  return new Date().toISOString()
}

export const logger = {
  debug(tag: string, message: string, data?: any): void {
    if (shouldLog('debug')) {
      console.log(`[${formatTimestamp()}] [DEBUG] [${tag}] ${message}`, data ?? '')
    }
  },

  info(tag: string, message: string, data?: any): void {
    if (shouldLog('info')) {
      console.log(`[${formatTimestamp()}] [INFO] [${tag}] ${message}`, data ?? '')
    }
  },

  warn(tag: string, message: string, data?: any): void {
    if (shouldLog('warn')) {
      console.warn(`[${formatTimestamp()}] [WARN] [${tag}] ${message}`, data ?? '')
    }
  },

  error(tag: string, message: string, error?: any): void {
    if (shouldLog('error')) {
      console.error(`[${formatTimestamp()}] [ERROR] [${tag}] ${message}`, error ?? '')
    }
  },

  // WebRTC-specific debug helpers
  rtc(tag: string, event: string, data?: any): void {
    this.debug(`RTC-${tag}`, event, data)
  },

  ice(tag: string, event: string, data?: any): void {
    this.debug(`ICE-${tag}`, event, data)
  },

  dtls(tag: string, event: string, data?: any): void {
    this.debug(`DTLS-${tag}`, event, data)
  },
}
