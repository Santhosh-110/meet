# Scalable WebRTC Classroom Video Calling

Architecture designed for 200–1000+ concurrent users per classroom using mediasoup SFU.

## Why SFU over Mesh P2P

```
MESH (P2P) - Fails at scale:
  User Count    Connections/User    Total Connections
      10              9                   90
     100             99                9,900   ← Browser crashes
    1000            999              999,000  ← Impossible

SFU (mediasoup) - Scales linearly:
  User Count    Connections/User    Total Connections
    1000              1                1,000   ← Each browser = 1 connection
```

SFU benefits:
- Each user uploads ONE stream (not N streams)
- Server intelligently forwards streams only where needed
- Simulcast: server sends appropriate quality to each viewer
- Reconnection affects only one client, not all peers

## Architecture

```
Browser (React) ◄──Signaling──► Node.js Server + Socket.IO
      │                              │
      │ WebRTC                        │ mediasoup
      ▼                              ▼
   mediasoup-client ◄──RTP/RTCP──► mediasoup Worker (SFU)
                                      │
                                      ▼
                                Redis (for horizontal scaling)
```

## Directory Structure

```
classroom_app/
├── src/                          # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── video/                # VideoPlayer, LocalVideo, RemoteVideo, VideoGrid
│   │   ├── controls/             # ControlBar
│   │   └── room/                 # Classroom, JoinForm, ParticipantList
│   ├── hooks/
│   │   ├── useMediasoup.ts       # Core mediasoup-client integration
│   │   └── useLocalMedia.ts      # Camera/mic capture
│   ├── stores/
│   │   └── classroomStore.ts     # Zustand state
│   ├── services/
│   │   ├── signaling.ts          # Socket.IO signaling client
│   │   └── logger.ts             # WebRTC debugging
│   └── types/
│       └── webrtc.ts             # TypeScript types
├── server/
│   ├── src/
│   │   ├── index.ts              # Server entry + mediasoup worker
│   │   ├── config/mediasoup.ts   # Worker/transport config
│   │   ├── rooms/
│   │   │   ├── Room.ts           # Room state + media routing
│   │   │   └── RoomManager.ts    # Room lifecycle management
│   │   ├── peers/Peer.ts         # Peer connection state
│   │   ├── routers/classroom.ts  # Socket.IO signaling handlers
│   │   ├── types/index.ts        # Shared types
│   │   └── utils/logger.ts       # Server logging
│   ├── package.json
│   └── tsconfig.json
└── package.json
```

## WebRTC Connection Lifecycle

```
1. Connect to signaling server (Socket.IO)
2. Fetch router RTP capabilities (codec negotiation)
3. Join room (server creates Peer + notifies others)
4. Create WebRTC send transport (client → SFU)
5. Create WebRTC recv transport (SFU → client)
6. Connect transports (DTLS handshake)
7. Produce local media (camera + mic → SFU)
8. Consume remote media (SFU → client)
9. ICE reconnection on network changes
10. Leave room (cleanup all transports/producers/consumers)
```

## Simulcast Configuration

Teacher broadcasts 3 quality layers:

| Layer | Resolution  | Bitrate  | Recipients           |
|-------|-------------|----------|----------------------|
| Low   | 160×90      | 150 Kbps | Bandwidth-limited    |
| Medium| 320×180     | 500 Kbps | Mobile connections   |
| High  | 640×360     | 1.5 Mbps | Desktop, good WiFi   |

SFU selectively forwards the appropriate layer to each viewer.
Viewers can request layer changes based on bandwidth estimates.

## Prerequisites

- Node.js 20+ (tested with Node 20-22)
- npm 9+
- Python 3.x (required for mediasoup native addon compilation)
- C++ build tools (Visual Studio Build Tools on Windows, Xcode on macOS, build-essential on Linux)
- redis-server (optional, for horizontal scaling)

## Development Setup

### 1. Install Frontend Dependencies

```bash
npm install
```

### 2. Install Server Dependencies

```bash
cd server
npm install
cd ..
```

### 3. Start the Server

```bash
cd server
npm run dev
```

The signaling server starts on `http://localhost:3001`.
Health check: `http://localhost:3001/health`

### 4. Start the Frontend

In a new terminal:

```bash
npm run dev
```

Frontend starts on `http://localhost:5173`.

### 5. Open Two Browser Tabs

1. Tab 1: Join as Teacher (click "Teacher" role)
2. Tab 2: Join as Student (click "Student" role)
3. Use the same Room ID for both

## Media Flow

```
TEACHER                  SFU (mediasoup)                  STUDENTS
   │                          │                              │
   │──cam-video──────────────►│                              │
   │──cam-audio──────────────►│                              │
   │                          │──forward to student (low)────►│ (limited bandwidth)
   │                          │──forward to student (hd)─────►│ (good connection)
   │──screen-share──────────►│                              │
   │                          │──forward screen──────►       │
   │                          │                              │
   │◄──────consumer (student)─│                              │
   │                          │◄────produce (student)────────│
```

## Scalability Techniques Used

1. **SFU Architecture**: Single connection per client to server
2. **Simulcast**: Multiple quality layers, server does selective forwarding
3. **Producer/Consumer Isolation**: Each media track independently managed
4. **Connection Resilience**: Transport-level DTLS state monitoring
5. **Selective State Management**: Zustand store prevents unnecessary re-renders
6. **Efficient DOM Updates**: Direct MediaStream attachment (no React re-renders for video)
7. **Memory Management**: Peer cleanup on disconnect, room cleanup when empty
8. **Active Speaker Detection**: Audio level thresholds minimize unnecessary updates

## Performance Testing Strategy

### Local Testing (200+ simulated users)

```bash
# Install k6 load testing
# Create test scripts that connect virtual peers
k6 run tests/scalability.js
```

### Key Metrics to Monitor

- CPU usage per mediasoup worker
- Memory usage per room
- WebRTC connection establishment time
- ICE connection success rate
- Packet loss percentage
- Jitter buffer statistics
- Frame drop rate
- Bandwidth utilization per peer

### Bottleneck Analysis

| Component | Limit | Mitigation |
|-----------|-------|------------|
| mediasoup Worker | CPU cores | Spawn 1 worker per core |
| WebRTC Port Range | 10,000 ports | Use multiple IPs/workers |
| Socket.IO | Single thread | Clustering + Redis adapter |
| Network Bandwidth | NIC capacity | Load balance across servers |
| Memory per Room | ~50MB + streams | Monitor and scale horizontally |

## Production Scaling (Future)

```
                    ┌─────────────┐
                    │  Load       │
                    │  Balancer   │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
   │ Worker  │        │ Worker  │        │ Worker  │
   │  Node 1 │◄──────►│  Node 2 │◄──────►│  Node 3 │
   └────┬────┘        └────┬────┘        └────┬────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │    Redis    │
                    │   (Pub/Sub) │
                    └─────────────┘
```

## mediasoup vs LiveKit Tradeoffs

| Aspect | mediasoup | LiveKit |
|--------|-----------|---------|
| **Control** | Full control over media pipeline | Higher-level API, less control |
| **Complexity** | More setup, raw WebRTC | Easier to start, built-in features |
| **Scaling** | Manual, but flexible | Built-in, but opinionated |
| **Customization** | Maximum (custom simulcast profiles) | Limited to LiveKit's abstractions |
| **Resource Usage** | Lighter, more efficient | Heavier, more built-in features |
| **Community** | Smaller, specialized | Larger, more active |

**Why mediasoup for this project**: Maximum control over media routing, lighter resource footprint, and ability to implement custom simulcast strategies optimized for the classroom use case (many viewers, few active speakers).
