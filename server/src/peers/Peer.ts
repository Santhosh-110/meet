import type { Transport, Producer, Consumer } from 'mediasoup/types'
import type { Role } from '../types'

// Peer represents a single connected participant
// Each peer maintains their own transports, producers, and consumers
// This isolation is critical: if one peer's producer fails,
// it doesn't affect other peers' state

export class Peer {
  readonly peerId: string
  readonly displayName: string
  readonly role: Role
  readonly joinedAt: number

  // Send transport: used by this peer to send media TO the SFU
  private _sendTransport: Transport | null = null

  // Recv transport: used by this peer to receive media FROM the SFU
  private _recvTransport: Transport | null = null

  // Producers: media this peer is sending (camera video, camera audio, screen share, etc.)
  private _producers: Map<string, Producer> = new Map()

  // Consumers: media this peer is receiving from OTHER peers
  private _consumers: Map<string, Consumer> = new Map()

  constructor(peerId: string, displayName: string, role: Role) {
    this.peerId = peerId
    this.displayName = displayName
    this.role = role
    this.joinedAt = Date.now()
  }

  get sendTransport(): Transport | null {
    return this._sendTransport
  }

  set sendTransport(transport: Transport | null) {
    this._sendTransport = transport
  }

  get recvTransport(): Transport | null {
    return this._recvTransport
  }

  set recvTransport(transport: Transport | null) {
    this._recvTransport = transport
  }

  get producers(): Map<string, Producer> {
    return this._producers
  }

  get consumers(): Map<string, Consumer> {
    return this._consumers
  }

  addProducer(producer: Producer): void {
    this._producers.set(producer.id, producer)
  }

  removeProducer(producerId: string): Producer | undefined {
    const producer = this._producers.get(producerId)
    if (producer) {
      producer.close()
      this._producers.delete(producerId)
    }
    return producer
  }

  addConsumer(consumer: Consumer): void {
    this._consumers.set(consumer.id, consumer)
  }

  removeConsumer(consumerId: string): Consumer | undefined {
    const consumer = this._consumers.get(consumerId)
    if (consumer) {
      consumer.close()
      this._consumers.delete(consumerId)
    }
    return consumer
  }

  // Close all transports and clean up resources
  close(): void {
    this._producers.forEach((producer) => producer.close())
    this._consumers.forEach((consumer) => consumer.close())
    this._sendTransport?.close()
    this._recvTransport?.close()
    this._producers.clear()
    this._consumers.clear()
  }

  toJSON() {
    return {
      peerId: this.peerId,
      displayName: this.displayName,
      role: this.role,
      joinedAt: this.joinedAt,
    }
  }
}
