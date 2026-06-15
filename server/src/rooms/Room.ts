import type { Router, Producer, Consumer } from 'mediasoup/types'
import { Peer } from '../peers/Peer'
import type { Role } from '../types'

// Room represents a single classroom
// It's the core unit of media routing:
// - All producers in this room can be consumed by all peers
// - The router manages RTP forwarding between peers
// - This isolation means each room is independent + horizontally scalable

export class Room {
  readonly roomId: string
  readonly router: Router
  readonly createdAt: number

  private _peers: Map<string, Peer> = new Map()
  // Track all producers in room for easy lookup when new peers join
  private _producers: Map<string, { peerId: string; producer: Producer }> = new Map()

  constructor(roomId: string, router: Router) {
    this.roomId = roomId
    this.router = router
    this.createdAt = Date.now()
  }

  get peers(): Peer[] {
    return Array.from(this._peers.values())
  }

  get peerCount(): number {
    return this._peers.size
  }

  getPeer(peerId: string): Peer | undefined {
    return this._peers.get(peerId)
  }

  addPeer(peerId: string, displayName: string, role: Role): Peer {
    const peer = new Peer(peerId, displayName, role)
    this._peers.set(peerId, peer)
    return peer
  }

  removePeer(peerId: string): Peer | undefined {
    const peer = this._peers.get(peerId)
    if (peer) {
      // Remove all producers for this peer from the room's producer registry
      for (const [producerId, entry] of this._producers.entries()) {
        if (entry.peerId === peerId) {
          this._producers.delete(producerId)
        }
      }
      peer.close()
      this._peers.delete(peerId)
    }
    return peer
  }

  hasPeer(peerId: string): boolean {
    return this._peers.has(peerId)
  }

  addProducer(peerId: string, producer: Producer): void {
    this._producers.set(producer.id, { peerId, producer })
    const peer = this._peers.get(peerId)
    peer?.addProducer(producer)
  }

  removeProducer(producerId: string): void {
    const entry = this._producers.get(producerId)
    if (entry) {
      const peer = this._peers.get(entry.peerId)
      peer?.removeProducer(producerId)
      this._producers.delete(producerId)
    }
  }

  // Get all producers EXCEPT the requesting peer's own
  // Used when a peer joins to subscribe to existing streams
  getProducerListForPeer(peerId: string): { peerId: string; producerId: string; kind: string; paused: boolean }[] {
    const list: { peerId: string; producerId: string; kind: string; paused: boolean }[] = []
    for (const [producerId, entry] of this._producers.entries()) {
      if (entry.peerId !== peerId) {
        list.push({
          peerId: entry.peerId,
          producerId: producerId,
          kind: entry.producer.kind,
          paused: entry.producer.paused,
        })
      }
    }
    return list
  }

  getRoomInfo() {
    return {
      roomId: this.roomId,
      peers: this.peers.map((p) => p.toJSON()),
    }
  }

  // Clean up room resources (but NOT the router - it's shared!)
  close(): void {
    this._peers.forEach((peer) => peer.close())
    this._peers.clear()
    this._producers.clear()
    // DO NOT close this.router - it's shared across all rooms and managed by RoomManager
  }

  // Alternative close for RoomManager to use when cleaning up without closing router
  closeWithoutRouter(): void {
    this._peers.forEach((peer) => peer.close())
    this._peers.clear()
    this._producers.clear()
  }
}
