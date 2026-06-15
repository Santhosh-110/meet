// WebRTC debugging logger
// Provides structured logging for WebRTC operations
// In production: send logs to a monitoring service

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const ENABLED = true
const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']
const CURRENT: LogLevel = 'debug'

function shouldLog(level: LogLevel): boolean {
  return ENABLED && LEVELS.indexOf(level) >= LEVELS.indexOf(CURRENT)
}

function ts(): string {
  return new Date().toISOString().slice(11, 23)
}

export const rtcLogger = {
  debug(tag: string, msg: string, data?: any): void {
    if (shouldLog('debug')) console.log(`[${ts()}] [WEBRTC] [${tag}] ${msg}`, data ?? '')
  },

  info(tag: string, msg: string, data?: any): void {
    if (shouldLog('info')) console.log(`[${ts()}] [WEBRTC] [${tag}] ${msg}`, data ?? '')
  },

  warn(tag: string, msg: string, data?: any): void {
    if (shouldLog('warn')) console.warn(`[${ts()}] [WEBRTC] [${tag}] ${msg}`, data ?? '')
  },

  error(tag: string, msg: string, err?: any): void {
    if (shouldLog('error')) console.error(`[${ts()}] [WEBRTC] [${tag}] ${msg}`, err ?? '')
  },

  // WebRTC-specific events
  ice(tag: string, event: string, data?: any): void {
    this.debug(`ICE:${tag}`, event, data)
  },

  transport(tag: string, event: string, data?: any): void {
    this.debug(`TRANSPORT:${tag}`, event, data)
  },

  producer(tag: string, event: string, data?: any): void {
    this.debug(`PRODUCER:${tag}`, event, data)
  },

  consumer(tag: string, event: string, data?: any): void {
    this.debug(`CONSUMER:${tag}`, event, data)
  },
}
