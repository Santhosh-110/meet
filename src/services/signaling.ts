import { io, Socket } from 'socket.io-client'
import type { Role, RoomInfo, PeerInfo } from '../types/webrtc'

// Signaling service: wraps Socket.IO for mediasoup signaling
//
// This is the control channel between frontend and backend.
// WebRTC media flows through the SFU (mediasoup), but negotiation
// (ICE candidates, DTLS params, etc.) happens over this signaling channel.
//
// Scaling note: Socket.IO supports Redis adapter for horizontal scaling.
// All signaling messages are lightweight JSON, so they're efficient even at scale.

export class SignalingService {
  // Exposed as public so useMediasoup can attach low-level socket listeners
  // (e.g. reconnect, audio-level). Use the helper methods for all signaling.
  public socket: Socket | null = null
  private serverUrl: string

  constructor(serverUrl: string = 'http://localhost:3001') {
    this.serverUrl = serverUrl
  }

  connect(): Promise<void> {
    return new Promise((resolve) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      })

      this.socket.on('connect', () => {
        console.log('[Signaling] Connected:', this.socket?.id)
        resolve()
      })

      this.socket.on('connect_error', (err) => {
        console.error('[Signaling] Connection error:', err.message)
      })

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('[Signaling] Reconnected after', attemptNumber, 'attempts')
      })

      this.socket.on('reconnect_attempt', () => {
        console.log('[Signaling] Attempting to reconnect...')
      })

      this.socket.on('reconnect_error', (err) => {
        console.error('[Signaling] Reconnection error:', err.message)
      })
    })
  }

  disconnect(): void {
    this.socket?.close()
    this.socket = null
  }

  getSocketId(): string | undefined {
    return this.socket?.id
  }

  /** Returns the raw socket — use only for low-level listeners in useMediasoup */
  getSocket(): Socket {
    if (!this.socket) throw new Error('Socket not connected')
    return this.socket
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  // ── Room ──────────────────────────────────────────────────────────────
  async join(roomId: string, role: Role, displayName: string, password?: string): Promise<RoomInfo> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('join', { roomId, role, displayName, password }, (response: any) => {
        if (response.success) {
          resolve(response.roomInfo)
        } else {
          reject(new Error(response.error))
        }
      })
    })
  }

  // NOTE: Meeting codes are generated instantly on the frontend (crypto.getRandomValues).
  // The code IS the roomId; no server round-trip is needed before joining.

  // ── Transports ────────────────────────────────────────────────────────
  async createTransport(direction: 'send' | 'recv'): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('create-transport', { direction }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error))
        } else {
          resolve(response)
        }
      })
    })
  }

  async connectTransport(transportId: string, dtlsParameters: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('connect-transport', { transportId, dtlsParameters }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error))
        } else {
          resolve()
        }
      })
    })
  }

  // ── Producers / Consumers ─────────────────────────────────────────────
  async produce(kind: string, rtpParameters: any, transportId: string): Promise<{ id: string; kind: string }> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('produce', { kind, rtpParameters, transportId }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error))
        } else {
          resolve(response)
        }
      })
    })
  }

  async consume(producerId: string, rtpCapabilities: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('consume', { producerId, rtpCapabilities }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error))
        } else {
          resolve(response)
        }
      })
    })
  }

  async setPreferredLayers(consumerId: string, spatialLayer: number, temporalLayer: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket?.emit('set-prefered-layers', { consumerId, spatialLayer, temporalLayer }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error))
        } else {
          resolve()
        }
      })
    })
  }

  async pauseProducer(producerId: string): Promise<void> {
    this.socket?.emit('pause-producer', { producerId })
  }

  async resumeProducer(producerId: string): Promise<void> {
    this.socket?.emit('resume-producer', { producerId })
  }

  // ── Chat ──────────────────────────────────────────────────────────────
  sendChatMessage(text: string, displayName: string): void {
    this.socket?.emit('chat-message', { text, displayName })
  }

  onChatMessage(callback: (msg: { id: string; peerId: string; displayName: string; text: string; timestamp: number }) => void): void {
    this.socket?.on('chat-message', callback)
  }

  // ── Raise hand ────────────────────────────────────────────────────────
  raiseHand(displayName: string): void {
    this.socket?.emit('raise-hand', { displayName })
  }

  lowerHand(): void {
    this.socket?.emit('lower-hand', {})
  }

  muteAllPeers(): void {
    this.socket?.emit('mute-all-peers')
  }

  onHostMute(callback: () => void): void {
    this.socket?.on('host-mute', callback)
  }

  mutePeer(peerId: string): void {
    this.socket?.emit('mute-peer', { peerId })
  }

  kickPeer(peerId: string): void {
    this.socket?.emit('kick-peer', { peerId })
  }

  endMeeting(): void {
    this.socket?.emit('end-meeting')
  }

  onHostKick(callback: (reason?: string) => void): void {
    this.socket?.on('host-kick', (data?: { reason?: string }) => {
      const reason = typeof data === 'object' && data !== null ? data.reason : undefined
      callback(reason)
    })
  }

  onRaiseHand(callback: (data: { peerId: string; displayName: string; raisedAt: number }) => void): void {
    this.socket?.on('peer-raised-hand', callback)
  }

  onLowerHand(callback: (data: { peerId: string }) => void): void {
    this.socket?.on('peer-lowered-hand', callback)
  }

  // ── Event listeners ───────────────────────────────────────────────────
  onPeerJoined(callback: (peer: PeerInfo) => void): void {
    this.socket?.on('peer-joined', callback)
  }

  onPeerLeft(callback: (data: { peerId: string }) => void): void {
    this.socket?.on('peer-left', callback)
  }

  onNewProducer(callback: (data: { peerId: string; producerId: string; kind: string }) => void): void {
    this.socket?.on('new-producer', callback)
  }

  onProducerPaused(callback: (data: { producerId: string }) => void): void {
    this.socket?.on('producer-paused', callback)
  }

  onProducerResumed(callback: (data: { producerId: string }) => void): void {
    this.socket?.on('producer-resumed', callback)
  }

  onActiveSpeaker(callback: (data: { peerId: string; volume: number }) => void): void {
    this.socket?.on('active-speaker', callback)
  }

  onPeerMediaState(callback: (data: { peerId: string; kind: string; enabled: boolean }) => void): void {
    this.socket?.on('peer-media-state', callback)
  }

  // ── Cleanup ───────────────────────────────────────────────────────────
  removeAllListeners(): void {
    this.socket?.removeAllListeners()
  }
}
