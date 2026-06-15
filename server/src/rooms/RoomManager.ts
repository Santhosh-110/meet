import type { Router } from 'mediasoup/types'
import { Room } from './Room'

// RoomManager: global room registry
// Handles room lifecycle - create, get, close rooms
// For MVP: in-memory storage
// For production: Redis-backed with pub/sub for multi-node
//
// Scaling strategy:
// - Each room is tied to a specific mediasoup router
// - Multiple rooms can share a single worker
// - In production, rooms can be distributed across workers/nodes
//   based on load

export interface Meeting {
  meetingId: string       // Unique code (abc-defg-hij)
  roomId: string          // Underlying room pointer (abc-defg-hij)
  teacherId?: string
  createdAt: number
  status: 'active' | 'ended'
  password?: string       // Optional password
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map()
  private workerRouter: Router | null = null

  // meetings: stores pre-created meetings independently of active rooms.
  private meetings: Map<string, Meeting> = new Map()
  // Reverse index: roomId → meetingId (to look up meetingId by roomId)
  private roomToCode: Map<string, string> = new Map()

  // Pre-create router from a mediasoup worker
  // In production, you'd have a pool of workers
  setRouter(router: Router): void {
    this.workerRouter = router
  }

  // ------------------------------------------------------------------
  // Meeting code helpers
  // ------------------------------------------------------------------

  /** Generate a unique abc-defg-hij style meeting code */
  private generateMeetingCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz'
    const rand = (len: number) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

    let code: string
    // Retry until unique (collision extremely unlikely but safe)
    do {
      code = `${rand(3)}-${rand(4)}-${rand(3)}`
    } while (this.meetings.has(code))

    return code
  }

  /** Generate a simple random roomId (separate from the human-readable code) */
  private generateRoomId(): string {
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  }

  /**
   * Create a new meeting code.
   * Returns the meeting details.
   */
  createMeeting(teacherId?: string, password?: string): Meeting {
    const meetingId = this.generateMeetingCode()
    const roomId = meetingId // Keep roomId equal to meetingId to align with client-side expectations
    const entry: Meeting = {
      meetingId,
      roomId,
      teacherId,
      createdAt: Date.now(),
      status: 'active',
      password
    }
    this.meetings.set(meetingId, entry)
    this.roomToCode.set(roomId, meetingId)
    return entry
  }

  getMeeting(meetingId: string): Meeting | undefined {
    return this.meetings.get(meetingId.trim().toLowerCase())
  }

  endMeeting(meetingId: string): void {
    const normalised = meetingId.trim().toLowerCase()
    const meeting = this.meetings.get(normalised)
    if (meeting) {
      meeting.status = 'ended'
      // Remove room if it exists
      this.removeRoom(meeting.roomId)
    }
  }

  /**
   * Validate a meeting code entered by a user.
   * Returns { valid: true, roomId } on success or { valid: false, error } on failure.
   */
  validateMeetingCode(code: string): { valid: boolean; roomId?: string; error?: string } {
    const normalised = code.trim().toLowerCase()
    const meeting = this.meetings.get(normalised)
    if (!meeting) {
      return { valid: false, error: 'Invalid meeting code. Please check and try again.' }
    }
    if (meeting.status === 'ended') {
      return { valid: false, error: 'This meeting has ended.' }
    }
    return { valid: true, roomId: meeting.roomId }
  }

  // ------------------------------------------------------------------
  // Room helpers
  // ------------------------------------------------------------------

  getOrCreateRoom(roomId: string): Room {
    if (!this.workerRouter) {
      throw new Error('Router not initialized')
    }

    let room = this.rooms.get(roomId)
    if (!room) {
      // Each room gets its own router for media isolation
      // In production: create new router from worker pool
      room = new Room(roomId, this.workerRouter)
      this.rooms.set(roomId, room)
    }
    return room
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  removeRoom(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (room) {
      room.close()
      this.rooms.delete(roomId)
    }
  }

  // Get router RTP capabilities for client initialization
  getRouterCapabilities() {
    return this.workerRouter?.rtpCapabilities ?? null
  }

  // Get all rooms (for capabilities negotiation)
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values())
  }

  // Get room count for monitoring/load balancing
  getRoomCount(): number {
    return this.rooms.size
  }

  // Get total peers across all rooms
  getTotalPeers(): number {
    let total = 0
    for (const room of this.rooms.values()) {
      total += room.peerCount
    }
    return total
  }

  // Close all rooms (on shutdown)
  closeAll(): void {
    // Close all room resources (but NOT the shared router)
    for (const room of this.rooms.values()) {
      room.closeWithoutRouter()
    }
    this.rooms.clear()
    this.meetings.clear()
    this.roomToCode.clear()
    // Now close the shared router (only done on server shutdown)
    if (this.workerRouter) {
      this.workerRouter.close()
      this.workerRouter = null
    }
  }
}

