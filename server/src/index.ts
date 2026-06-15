import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import * as mediasoup from 'mediasoup'
import { config } from './config/mediasoup'
import { RoomManager } from './rooms/RoomManager'
import { setupClassroomRouter } from './routers/classroom'
import { logger } from './utils/logger'

// Server configuration
const PORT = Number(process.env.PORT) || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

async function main(): Promise<void> {
  // -----------------------------------------------------------------
  // 1. Set up HTTP + Socket.IO server
  //    Socket.IO handles signaling: room management, transport creation,
  //    ICE candidate exchange, DTLS parameters
  // -----------------------------------------------------------------
  const app = express()
  app.use(express.json())
  const httpServer = createServer(app)
  const roomManager = new RoomManager()

  const io = new Server(httpServer, {
    cors: {
      origin: CORS_ORIGIN,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    },
    // Scalability: enable socket.io adapter for Redis in production
    // adapter: createRedisAdapter(redisClient),
    pingInterval: 10000,
    pingTimeout: 5000,
  })

  // Manual CORS Middleware
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') {
      res.sendStatus(200)
    } else {
      next()
    }
  })

  // Legacy room validation endpoint (kept for backward compatibility)
  app.get('/validate-room/:roomId', (req, res) => {
    const { roomId } = req.params
    const exists = roomManager.getRoom(roomId) !== undefined
    res.json({ exists })
  })

  // POST /api/meetings/create
  app.post('/api/meetings/create', (req, res) => {
    try {
      const { teacherId, password } = req.body
      const meeting = roomManager.createMeeting(teacherId, password)
      res.json({ success: true, meeting })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // GET /api/meetings/:meetingId
  app.get('/api/meetings/:meetingId', (req, res) => {
    const { meetingId } = req.params
    const meeting = roomManager.getMeeting(meetingId)
    if (!meeting) {
      res.json({ exists: false })
      return
    }

    const room = roomManager.getRoom(meeting.roomId)
    const participantCount = room ? room.peerCount : 0

    res.json({
      exists: true,
      meetingId: meeting.meetingId,
      roomId: meeting.roomId,
      teacherId: meeting.teacherId,
      createdAt: meeting.createdAt,
      status: meeting.status,
      participantCount,
      hasPassword: !!meeting.password
    })
  })

  // POST /api/meetings/:meetingId/verify
  app.post('/api/meetings/:meetingId/verify', (req, res) => {
    const { meetingId } = req.params
    const { password } = req.body
    const meeting = roomManager.getMeeting(meetingId)
    if (!meeting) {
      res.status(404).json({ success: false, error: 'Meeting not found' })
      return
    }
    if (meeting.status === 'ended') {
      res.status(400).json({ success: false, error: 'Meeting has ended' })
      return
    }
    if (!meeting.password) {
      res.json({ success: true, message: 'No password required' })
      return
    }
    if (meeting.password === password) {
      res.json({ success: true })
    } else {
      res.status(401).json({ success: false, error: 'Incorrect passcode' })
    }
  })

  // DELETE /api/meetings/:meetingId
  app.delete('/api/meetings/:meetingId', (req, res) => {
    const { meetingId } = req.params
    const meeting = roomManager.getMeeting(meetingId)
    if (meeting) {
      // Force kick all sockets connected in the room
      io.to(meeting.roomId).emit('host-kick', { reason: 'meeting-ended' })
      roomManager.endMeeting(meetingId)
      res.json({ success: true, message: 'Meeting ended' })
    } else {
      res.status(404).json({ success: false, error: 'Meeting not found' })
    }
  })

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      rooms: roomManager.getRoomCount(),
      peers: roomManager.getTotalPeers(),
      uptime: process.uptime(),
    })
  })

  // -----------------------------------------------------------------
  // 2. Initialize mediasoup workers
  //    Workers are the CPU cores for media processing
  //    Each worker handles: RTP/RTCP, DTLS, ICE, SRTP
  //    For MVP: 1 worker is sufficient
  //    Production: spawn 1 worker per CPU core, distribute rooms
  // -----------------------------------------------------------------
  logger.info('MEDIASOUP', 'Starting mediasoup workers...')

  const worker = await mediasoup.createWorker({
    logLevel: config.worker.logLevel,
    logTags: config.worker.logTags as any,
    rtcMinPort: config.worker.rtcMinPort,
    rtcMaxPort: config.worker.rtcMaxPort,
  })

  logger.info('MEDIASOUP', `Worker created (pid: ${worker.pid})`)

  worker.on('died', () => {
    logger.error('MEDIASOUP', 'Worker died unexpectedly!')
    // In production: gracefully fail over to another worker
    process.exit(1)
  })

  // -----------------------------------------------------------------
  // 3. Create mediasoup router
  //    Routers define supported codecs and media capabilities
  //    Each room gets a router for media isolation between rooms
  // -----------------------------------------------------------------
  const router = await worker.createRouter({
    mediaCodecs: config.router.mediaCodecs,
  })

  logger.info('MEDIASOUP', 'Router created with codecs:', config.router.mediaCodecs.map(c => c.mimeType))

  // -----------------------------------------------------------------
  // 4. Configure Room Manager
  //    Manages room lifecycle across the server
  // -----------------------------------------------------------------
  roomManager.setRouter(router)

  // -----------------------------------------------------------------
  // 5. Handle Socket.IO connections
  //    Each connected peer gets a socket for signaling
  // -----------------------------------------------------------------
  io.on('connection', (socket) => {
    logger.info('SIGNALING', `Peer connected: ${socket.id}`)

    // Set up classroom signaling handlers for this peer
    setupClassroomRouter(io, socket, roomManager)

    socket.on('error', (err) => {
      logger.error('SIGNALING', `Socket error for ${socket.id}:`, err)
    })
  })

  // -----------------------------------------------------------------
  // 6. Start the server
  // -----------------------------------------------------------------
  httpServer.listen(PORT, () => {
    logger.info('SERVER', `Signaling server running on port ${PORT}`)
    logger.info('SERVER', `CORS origin: ${CORS_ORIGIN}`)
    logger.info('SERVER', `WebRTC ports: ${config.worker.rtcMinPort}-${config.worker.rtcMaxPort}`)
  })

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('SERVER', 'Shutting down...')
    roomManager.closeAll()
    worker.close()
    httpServer.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  logger.error('SERVER', 'Fatal error:', err)
  process.exit(1)
})
