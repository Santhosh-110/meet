import { Socket } from 'socket.io'
import { RoomManager } from '../rooms/RoomManager'
import type { Role, ProducerKind } from '../types'
import { config } from '../config/mediasoup'

const joinRateLimits: Map<string, number[]> = new Map()

// Classroom router handles all WebRTC signaling events
// This is the bridge between clients and the mediasoup SFU
//
// Signaling flow:
//   1. Client requests to join a room
//   2. Server creates/gets room, adds peer
//   3. Client creates send transport (for publishing media)
//   4. Client creates recv transport (for receiving remote media)
//   5. Client produces media (camera, mic)
//   6. Server notifies other peers to consume this producer
//   7. Each peer creates consumers for new producers

export function setupClassroomRouter(
  io: any,
  socket: Socket,
  roomManager: RoomManager
): void {
  const log = (msg: string, data?: any) => {
    console.log(`[Classroom] ${msg}`, data ? JSON.stringify(data, null, 2) : '')
  }

  socket.on('create-room', async ({ roomId }: { roomId: string }, callback: Function) => {
    try {
      const room = roomManager.getOrCreateRoom(roomId)
      callback({ success: true, room: room.getRoomInfo() })
    } catch (err: any) {
      callback({ success: false, error: err.message })
    }
  })

  // NOTE: Meeting codes are generated instantly on the frontend (crypto.getRandomValues).
  // The code IS the roomId; rooms are created on-demand by the 'join' handler below.

  // ── Chat ──────────────────────────────────────────────────────────────
  // Broadcast to all peers in the room (including sender, for consistency)
  socket.on('chat-message', ({ text, displayName }: { text: string; displayName: string }) => {
    const roomId = (socket as any).roomId
    if (!roomId) return
    const room = roomManager.getRoom(roomId)
    if (!room) return

    const message = {
      id: `${socket.id}-${Date.now()}`,
      peerId: socket.id,
      displayName,
      text: (text || '').slice(0, 500), // cap at 500 chars
      timestamp: Date.now(),
    }

    for (const peer of room.peers) {
      io.to(peer.peerId).emit('chat-message', message)
    }
    log(`Chat in ${roomId} from ${displayName}: ${text.slice(0, 40)}`)
  })

  // ── Raise hand ────────────────────────────────────────────────────────
  socket.on('raise-hand', ({ displayName }: { displayName: string }) => {
    const roomId = (socket as any).roomId
    if (!roomId) return
    const room = roomManager.getRoom(roomId)
    if (!room) return

    const payload = { peerId: socket.id, displayName, raisedAt: Date.now() }
    for (const peer of room.peers) {
      io.to(peer.peerId).emit('peer-raised-hand', payload)
    }
    log(`Hand raised in ${roomId} by ${displayName}`)
  })

  socket.on('lower-hand', () => {
    const roomId = (socket as any).roomId
    if (!roomId) return
    const room = roomManager.getRoom(roomId)
    if (!room) return

    const payload = { peerId: socket.id }
    for (const peer of room.peers) {
      io.to(peer.peerId).emit('peer-lowered-hand', payload)
    }
  })

  socket.on('mute-all-peers', () => {
    const roomId = (socket as any).roomId
    if (!roomId) return
    const room = roomManager.getRoom(roomId)
    if (!room) return

    for (const peer of room.peers) {
      if (peer.peerId !== socket.id) {
        io.to(peer.peerId).emit('host-mute')
      }
    }
  })

  socket.on('mute-peer', ({ peerId }: { peerId: string }) => {
    const roomId = (socket as any).roomId
    if (!roomId) return
    const room = roomManager.getRoom(roomId)
    if (!room) return

    const senderPeer = room.getPeer(socket.id)
    if (senderPeer?.role !== 'teacher') return

    io.to(peerId).emit('host-mute')
    log(`Peer ${peerId} was specifically muted by host ${socket.id}`)
  })

  socket.on('kick-peer', ({ peerId }: { peerId: string }) => {
    const roomId = (socket as any).roomId
    if (!roomId) return
    const room = roomManager.getRoom(roomId)
    if (!room) return

    const senderPeer = room.getPeer(socket.id)
    if (senderPeer?.role !== 'teacher') return

    io.to(peerId).emit('host-kick')
    log(`Peer ${peerId} was kicked by host ${socket.id}`)
  })

  socket.on('end-meeting', () => {
    const roomId = (socket as any).roomId
    if (!roomId) return
    const room = roomManager.getRoom(roomId)
    if (!room) return

    const senderPeer = room.getPeer(socket.id)
    if (senderPeer?.role !== 'teacher') return

    // Notify all other peers in the room that the host ended the meeting
    for (const peer of room.peers) {
      if (peer.peerId !== socket.id) {
        io.to(peer.peerId).emit('host-kick', { reason: 'meeting-ended' })
      }
    }

    // Clean up room and mark meeting status as ended
    roomManager.endMeeting(roomId)
    log(`Meeting ${roomId} ended for everyone by host ${socket.id}`)
  })



  // Client fetches router RTP capabilities to initialize mediasoup device
  // This must happen BEFORE joining a room (device needs capabilities first)
  socket.on('get-router-capabilities', (_data: any, callback: Function) => {
    try {
      // Expose the router's RTP capabilities so the client can initialize its mediasoup Device.
      // The Device uses these to negotiate compatible codecs with the server.
      const rtpCapabilities = roomManager.getRouterCapabilities()
      if (!rtpCapabilities) {
        throw new Error('Router not initialized')
      }
      callback({ rtpCapabilities })
    } catch (err: any) {
      callback({ error: err.message })
    }
  })

  socket.on('join', async (
    { roomId, role, displayName, password }: { roomId: string; role: Role; displayName: string; password?: string },
    callback: Function
  ) => {
    let room = null
    try {
      const normalizedRoomId = roomId.trim().toLowerCase()

      // 1. Validate Room Format
      if (!/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(normalizedRoomId)) {
        throw new Error('Invalid meeting ID format')
      }

      // 2. Simple Rate Limiting per IP
      const ip = socket.handshake.address
      const now = Date.now()
      const timestamps = joinRateLimits.get(ip) || []
      const oneMinuteAgo = now - 60000
      const activeTimestamps = timestamps.filter(t => t > oneMinuteAgo)
      activeTimestamps.push(now)
      joinRateLimits.set(ip, activeTimestamps)
      if (activeTimestamps.length > 15) {
        throw new Error('Too many join attempts. Please try again in a minute.')
      }

      // 3. Validate Meeting and Password
      const meeting = roomManager.getMeeting(normalizedRoomId)
      if (!meeting) {
        throw new Error('Classroom not found')
      }
      if (meeting.status === 'ended') {
        throw new Error('Meeting ended')
      }
      if (meeting.password && meeting.password !== password && role !== 'teacher') {
        throw new Error('Invalid classroom password')
      }

      // 4. Capacity Limit (25 max users)
      const existingRoom = roomManager.getRoom(normalizedRoomId)
      if (existingRoom && existingRoom.peerCount >= 25) {
        throw new Error('Room full')
      }

      // 5. Prevent Duplicate Joined Peer Names
      if (existingRoom) {
        const nameInUse = existingRoom.peers.some(
          (p) => p.displayName.toLowerCase() === displayName.toLowerCase() && p.peerId !== socket.id
        )
        if (nameInUse) {
          throw new Error('A participant with this name is already in the classroom. Please choose another name.')
        }
      }

      room = roomManager.getOrCreateRoom(normalizedRoomId)
      
      // Defensive: verify room has expected methods before using them
      if (!room) {
        throw new Error('Room creation returned null')
      }
      if (typeof room.addPeer !== 'function') {
        throw new Error('Room.addPeer is not a function')
      }
      
      const peer = room.addPeer(socket.id, displayName, role)

      // Join the Socket.IO room for room-wide broadcasts
      await socket.join(normalizedRoomId)

      // Store room ID on socket for disconnection handling
      ;(socket as any).roomId = normalizedRoomId

      log(`Peer ${socket.id} (${displayName}) joined room ${normalizedRoomId} as ${role}`)

      // Send room info back to joining peer
      // IMPORTANT: exclude the joining peer from peers list since they are the local user
      const roomInfo = {
        roomId: room.roomId,
        peers: room.peers.filter((p) => p.peerId !== socket.id).map((p) => p.toJSON()),
      }

      // Notify other peers in room about new peer
      const peers = room.peers
      for (const otherPeer of peers) {
        if (otherPeer.peerId !== socket.id) {
          io.to(otherPeer.peerId).emit('peer-joined', peer.toJSON())
        }
      }

      // Send existing producers to the new peer so they can consume them
      const existingProducers = room.getProducerListForPeer(socket.id)
      for (const prod of existingProducers) {
        socket.emit('new-producer', {
          peerId: prod.peerId,
          producerId: prod.producerId,
          kind: prod.kind,
        })
      }

      callback({ success: true, roomInfo })
    } catch (err: any) {
      log(`Error in join for room ${roomId}: ${err.message}`)
      callback({ success: false, error: err.message || 'Unknown error joining room' })
    }
  })

  socket.on('create-transport', async (
    { direction }: { direction: 'send' | 'recv' },
    callback: Function
  ) => {
    try {
      const roomId = (socket as any).roomId
      const room = roomManager.getRoom(roomId)
      if (!room) throw new Error('Room not found')

      const peer = room.getPeer(socket.id)
      if (!peer) throw new Error('Peer not found')

      // Create WebRTC transport on the mediasoup router
      // Transport types:
      //   - send: client → SFU (client publishes media)
      //   - recv: SFU → client (client receives media)
      const transport = await room.router.createWebRtcTransport(
        config.webRtcTransport
      )

      // Store transport on peer
      if (direction === 'send') {
        peer.sendTransport = transport
      } else {
        peer.recvTransport = transport
      }

      // Listen for transport-level DTLS state changes (for reconnection)
      transport.on('dtlsstatechange', (dtlsState: string) => {
        if (dtlsState === 'closed') {
          log(`Transport ${transport.id} DTLS closed for peer ${socket.id}`)
        }
      })

      // Listen for transport router close or ICE state changes
      transport.on('routerclose', () => {
        log(`Router closed for transport ${transport.id} of peer ${socket.id}`)
      })

      // Return transport parameters for client to connect
      // Note: mediasoup-client expects 'id' not 'transportId'
      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      })
    } catch (err: any) {
      callback({ error: err.message })
    }
  })

  socket.on('connect-transport', async (
    { transportId, dtlsParameters }: { transportId: string; dtlsParameters: any },
    callback: Function
  ) => {
    try {
      const roomId = (socket as any).roomId
      const room = roomManager.getRoom(roomId)
      if (!room) throw new Error('Room not found')

      const peer = room.getPeer(socket.id)
      if (!peer) throw new Error('Peer not found')

      // Find the transport (could be send or recv)
      const transport = peer.sendTransport?.id === transportId
        ? peer.sendTransport
        : peer.recvTransport?.id === transportId
          ? peer.recvTransport
          : null

      if (!transport) throw new Error('Transport not found')

      // Connect the transport with DTLS parameters from client
      // This completes the WebRTC handshake
      await transport.connect({ dtlsParameters })

      callback({ success: true, transportId })
    } catch (err: any) {
      callback({ error: err.message })
    }
  })

  socket.on('produce', async (
    { kind, rtpParameters, transportId }: { kind: ProducerKind; rtpParameters: any; transportId: string },
    callback: Function
  ) => {
    try {
      const roomId = (socket as any).roomId
      const room = roomManager.getRoom(roomId)
      if (!room) throw new Error('Room not found')

      const peer = room.getPeer(socket.id)
      if (!peer) throw new Error('Peer not found')

      const transport = peer.sendTransport
      if (!transport || transport.id !== transportId) {
        throw new Error('Invalid transport')
      }

      // Producer options: configure simulcast for video
      const producerOptions: any = {
        kind: kind.includes('video') ? 'video' : 'audio',
        rtpParameters,
      }

      // Enable simulcast for video producers (camera and screen)
      // Simulcast: producer sends multiple quality layers
      //   - Teacher broadcasts 3 layers (HQ, MQ, LQ)
      //   - Each student receives the layer that fits their bandwidth
      //   - SFU selectively forwards: saves bandwidth on upstream AND downstream
      if (kind === 'cam-video' || kind === 'screen-video') {
        producerOptions.pipeThroughRouter = true
      }

      const producer = await transport.produce(producerOptions)

      // Store producer in room
      room.addProducer(socket.id, producer)

      log(`Peer ${socket.id} produced ${kind} (producerId: ${producer.id})`)

      // Notify other peers in room that a new producer is available
      // Each peer will create a consumer for this producer
      for (const otherPeer of room.peers) {
        if (otherPeer.peerId !== socket.id) {
          io.to(otherPeer.peerId).emit('new-producer', {
            peerId: socket.id,
            producerId: producer.id,
            kind: producer.kind,
          })
        }
      }

      callback({ id: producer.id, kind: producer.kind })
    } catch (err: any) {
      callback({ error: err.message })
    }
  })

  socket.on('consume', async (
    { producerId, rtpCapabilities }: { producerId: string; rtpCapabilities: any },
    callback: Function
  ) => {
    try {
      const roomId = (socket as any).roomId
      const room = roomManager.getRoom(roomId)
      if (!room) throw new Error('Room not found')

      const peer = room.getPeer(socket.id)
      if (!peer) throw new Error('Peer not found')

      const transport = peer.recvTransport
      if (!transport) {
        throw new Error('Recv transport not created')
      }

      // Check if router can consume this producer with the client's capabilities
      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        throw new Error('Cannot consume producer')
      }

      // Create consumer
      // SFU key: consumer is the downstream flow from SFU → client
      // With simulcast, each consumer can request specific quality layers
      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: false,
      })

      peer.addConsumer(consumer)

      // Listen for producer pause/resume events to forward to consumer
      consumer.on('producerpause', () => {
        socket.emit('consumer-paused', { consumerId: consumer.id })
      })

      consumer.on('producerresume', () => {
        socket.emit('consumer-resumed', { consumerId: consumer.id })
      })

      callback({
        peerId: socket.id,
        producerId,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused,
      })
    } catch (err: any) {
      callback({ error: err.message })
    }
  })

  // Handle simulcast layer switching
  // Client requests: "I want layer 1 (medium quality)"
  // SFU responds: switches to forwarding that layer
  socket.on('set-prefered-layers', async (
    { consumerId, spatialLayer, temporalLayer }: { consumerId: string; spatialLayer: number; temporalLayer: number },
    callback: Function
  ) => {
    try {
      const roomId = (socket as any).roomId
      const room = roomManager.getRoom(roomId)
      if (!room) throw new Error('Room not found')

      const peer = room.getPeer(socket.id)
      if (!peer) throw new Error('Peer not found')

      const consumer = peer.consumers.get(consumerId)
      if (!consumer) throw new Error('Consumer not found')

      // Set preferred layers for simulcast
      await consumer.setPreferredLayers({ spatialLayer, temporalLayer })

      callback({ success: true })
    } catch (err: any) {
      callback({ error: err.message })
    }
  })

  // Handle media pause/resume
  socket.on('pause-producer', async ({ producerId }: { producerId: string }) => {
    const roomId = (socket as any).roomId
    const room = roomManager.getRoom(roomId)
    if (!room) return

    const peer = room.getPeer(socket.id)
    if (!peer) return

    const producer = peer.producers.get(producerId)
    if (producer) {
      await producer.pause()
      // Notify other peers
      socket.to(roomId).emit('producer-paused', { producerId })
    }
  })

  socket.on('resume-producer', async ({ producerId }: { producerId: string }) => {
    const roomId = (socket as any).roomId
    const room = roomManager.getRoom(roomId)
    if (!room) return

    const peer = room.getPeer(socket.id)
    if (!peer) return

    const producer = peer.producers.get(producerId)
    if (producer) {
      await producer.resume()
      socket.to(roomId).emit('producer-resumed', { producerId })
    }
  })

  // Active speaker reporting
  // Client periodically sends audio levels, server broadcasts the loudest peer
  socket.on('audio-level', ({ level }: { level: number }) => {
    const roomId = (socket as any).roomId
    const room = roomManager.getRoom(roomId)
    if (!room) return

    // Broadcast volume to all peers in room
    // Frontend uses this to highlight active speaker
    socket.to(roomId).emit('active-speaker', {
      peerId: socket.id,
      volume: level,
    })
  })

  // Mute/unmute notifications
  socket.on('media-state-changed', ({ kind, enabled }: { kind: string; enabled: boolean }) => {
    const roomId = (socket as any).roomId
    if (!roomId) return
    socket.to(roomId).emit('peer-media-state', {
      peerId: socket.id,
      kind,
      enabled,
    })
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    const roomId = (socket as any).roomId
    if (!roomId) return

    const room = roomManager.getRoom(roomId)
    if (!room) return

    log(`Peer ${socket.id} disconnected from room ${roomId}`)
    room.removePeer(socket.id)
    io.to(roomId).emit('peer-left', { peerId: socket.id })

    // Remove room if empty (cleanup)
    if (room.peerCount === 0) {
      roomManager.removeRoom(roomId)
      log(`Room ${roomId} removed (empty)`)
    }
  })
}
