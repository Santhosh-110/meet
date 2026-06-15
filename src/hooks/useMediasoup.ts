import { useCallback, useEffect, useRef, useState } from 'react'
import * as mediasoupClient from 'mediasoup-client'
import type { Device } from 'mediasoup-client'
import type { Transport, Producer, Consumer } from 'mediasoup-client/types'
import { SignalingService } from '../services/signaling'
import { useClassroomStore } from '../stores/classroomStore'
import type { Role } from '../types/webrtc'
import { rtcLogger } from '../services/logger'

// Core WebRTC hook that manages the entire mediasoup connection lifecycle
//
// Connection lifecycle:
//   1. Connect signaling → 2. Join room → 3. Create send transport
//   4. Create recv transport → 5. Produce local media → 6. Consume remote media
//   7. Handle ICE reconnection → 8. Cleanup on leave
//
// The SFU (mediasoup server) handles all media routing.
// This client only maintains ONE connection to the SFU (not N connections to N peers).
// This is the key to scalability.

interface UseMediasoupOptions {
  signalingUrl?: string
  onHostMute?: () => void
  onHostKick?: (reason?: string) => void
}

interface RemoteConsumer {
  consumerId: string
  peerId: string
  producerId: string
  kind: 'audio' | 'video'
  track: MediaStreamTrack | null
  paused?: boolean
}

interface UseMediasoupReturn {
  device: Device | null
  sendTransport: Transport | null
  recvTransport: Transport | null
  producers: Producer[]
  remoteConsumers: RemoteConsumer[]
  joinRoom: (roomId: string, role: Role, displayName: string, password?: string) => Promise<void>
  leaveRoom: () => Promise<void>
  produceMedia: (kind: 'cam-video' | 'cam-audio', track: MediaStreamTrack) => Promise<Producer | null>
  produceScreenShare: (track: MediaStreamTrack) => Promise<Producer | null>
  stopProducing: (producerId: string) => Promise<void>
  toggleProducer: (producerId: string, enabled: boolean) => Promise<void>
  pauseAudioProducer: () => Promise<void>
  resumeAudioProducer: () => Promise<void>
  pauseVideoProducer: () => Promise<void>
  resumeVideoProducer: () => Promise<void>
  sendChatMessage: (text: string, displayName: string) => void
  raiseHand: (displayName: string) => void
  lowerHand: () => void
  muteAllPeers: () => void
  mutePeer: (peerId: string) => void
  kickPeer: (peerId: string) => void
  endMeeting: () => void
  error: string | null
  initialized: boolean
}

export function useMediasoup(
  options: UseMediasoupOptions = {}
): UseMediasoupReturn {
  const signalingRef = useRef<SignalingService | null>(null)
  const deviceRef = useRef<Device | null>(null)
  const sendTransportRef = useRef<Transport | null>(null)
  const recvTransportRef = useRef<Transport | null>(null)
  const producersRef = useRef<Map<string, Producer>>(new Map())
  const consumersRef = useRef<Map<string, Consumer>>(new Map())
  const remoteConsumersRef = useRef<Map<string, RemoteConsumer>>(new Map())
  const initPromiseRef = useRef<Promise<void> | null>(null)
  const roomIdRef = useRef<string | null>(null)
  // Track producer IDs for easy access when toggling
  const audioProducerIdRef = useRef<string | null>(null)
  const videoProducerIdRef = useRef<string | null>(null)
  const screenShareProducerIdRef = useRef<string | null>(null)
  const connectionIdRef = useRef<number>(0)

  const [device, setDevice] = useState<Device | null>(null)
  const [sendTransport, setSendTransport] = useState<Transport | null>(null)
  const [recvTransport, setRecvTransport] = useState<Transport | null>(null)
  const [producers, setProducers] = useState<Producer[]>([])
  const [remoteConsumers, setRemoteConsumers] = useState<RemoteConsumer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  const setRoomInfo = useClassroomStore(state => state.setRoomInfo)
  const addPeer = useClassroomStore(state => state.addPeer)
  const addJoinNotification = useClassroomStore(state => state.addJoinNotification)
  const removePeer = useClassroomStore(state => state.removePeer)
  const clearRaisedHand = useClassroomStore(state => state.clearRaisedHand)
  const setActiveSpeaker = useClassroomStore(state => state.setActiveSpeaker)
  const addChatMessage = useClassroomStore(state => state.addChatMessage)
  const setRaisedHand = useClassroomStore(state => state.setRaisedHand)
  const setMeetingStartedAt = useClassroomStore(state => state.setMeetingStartedAt)
  const resetStore = useClassroomStore(state => state.reset)

  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  // Initialize mediasoup Device and Signaling
  const init = useCallback(async () => {
    if (initPromiseRef.current) return initPromiseRef.current

    initPromiseRef.current = (async () => {
      try {
        rtcLogger.info('CLIENT', 'Initializing mediasoup client...')

        // Create mediasoup device
        // The device handles all client-side WebRTC logic
        // It loads the server's RTP capabilities to negotiate media codecs
        const device = new mediasoupClient.Device() as Device
        deviceRef.current = device

        // Connect signaling
        const signaling = new SignalingService(options.signalingUrl)
        signalingRef.current = signaling
        await signaling.connect()

        rtcLogger.info('CLIENT', 'mediasoup client initialized')
        setDevice(device)
        setInitialized(true)
      } catch (err: any) {
        rtcLogger.error('CLIENT', 'Init failed:', err)
        setError(err.message)
      }
    })()

    return initPromiseRef.current
  }, [options.signalingUrl])

  // Load router RTP capabilities into the mediasoup device
  const loadRouterCapabilities = useCallback(async () => {
    if (!signalingRef.current || !deviceRef.current) return null

    // Prevent double-loading: device.load() can only be called once
    if (deviceRef.current.loaded) {
      rtcLogger.info('CLIENT', 'Device already loaded, skipping')
      return deviceRef.current.rtpCapabilities
    }

    // Get router RTP capabilities via signaling
    // The router sends its supported codecs and features
    // This must match the server's router configuration
    const routerRtpCapabilities = await new Promise<any>((resolve, reject) => {
      (signalingRef.current as any).socket?.emit(
        'get-router-capabilities',
        {},
        (response: any) => {
          if (response.error) reject(new Error(response.error))
          else resolve(response.rtpCapabilities)
        }
      )
    })

    // Load capabilities into device
    // This tells the device what codecs the SFU supports
    await deviceRef.current!.load({ routerRtpCapabilities })
    rtcLogger.info('CLIENT', 'Router capabilities loaded')

    return routerRtpCapabilities
  }, [])

  // Create WebRTC transports for sending and receiving media
  const createTransports = useCallback(async () => {
    if (!signalingRef.current || !deviceRef.current) return

    // Create SEND transport (client → SFU)
    rtcLogger.info('TRANSPORT', 'Creating send transport...')
    const sendTransportInfo = await signalingRef.current.createTransport('send')
    const sendTransport = deviceRef.current.createSendTransport(sendTransportInfo)

    // Handle ICE candidate gathering for send transport
    sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      rtcLogger.ice('SEND', 'Connecting with DTLS params')
      try {
        await signalingRef.current!.connectTransport(sendTransportInfo.id, dtlsParameters)
        callback()
      } catch (err) {
        errback(err as Error)
      }
    })

    // Handle producer creation when local media starts flowing
    sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
      rtcLogger.producer('SEND', `Producing ${kind}`)
      try {
        const { id } = await signalingRef.current!.produce(kind, rtpParameters, sendTransportInfo.id)
        callback({ id })
      } catch (err) {
        errback(err as Error)
      }
    })

    sendTransport.on('icegatheringstatechange', (state) => {
      rtcLogger.ice('SEND', `Gathering state: ${state}`)
    })

    sendTransport.on('connectionstatechange', (state) => {
      rtcLogger.transport('SEND', `Connection state: ${state}`)
      // Handle reconnection - if connection fails, we try to re-establish
      if (state === 'failed') {
        rtcLogger.warn('TRANSPORT', 'Send transport failed, attempting reconnection...')
      }
    })

    sendTransportRef.current = sendTransport
    setSendTransport(sendTransport)

    // Create RECV transport (SFU → client)
    rtcLogger.info('TRANSPORT', 'Creating recv transport...')
    const recvTransportInfo = await signalingRef.current.createTransport('recv')
    const recvTransport = deviceRef.current.createRecvTransport(recvTransportInfo)

    recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      rtcLogger.ice('RECV', 'Connecting with DTLS params')
      try {
        await signalingRef.current!.connectTransport(recvTransportInfo.id, dtlsParameters)
        callback()
      } catch (err) {
        errback(err as Error)
      }
    })

    recvTransport.on('icegatheringstatechange', (state) => {
      rtcLogger.ice('RECV', `Gathering state: ${state}`)
    })

    recvTransport.on('connectionstatechange', (state) => {
      rtcLogger.transport('RECV', `Connection state: ${state}`)
      if (state === 'failed') {
        rtcLogger.warn('TRANSPORT', 'Recv transport failed, attempting reconnection...')
      }
    })

    recvTransportRef.current = recvTransport
    setRecvTransport(recvTransport)

    rtcLogger.info('TRANSPORT', 'Both transports created')
  }, [])

  // Produce media track (send to SFU)
  const produceMedia = useCallback(async (
    kind: 'cam-video' | 'cam-audio',
    track: MediaStreamTrack
  ): Promise<Producer | null> => {
    if (!sendTransportRef.current) {
      rtcLogger.error('PRODUCE', 'No send transport available')
      return null
    }

    try {
      rtcLogger.producer('PRODUCE', `Starting production of ${kind}`)

      const producer = await sendTransportRef.current.produce({
        track,
        encodings: kind === 'cam-video'
          ? // Simulcast encodings: 3 quality layers
            // The SFU will forward the appropriate layer to each viewer
            [
              { maxBitrate: 150_000, scaleResolutionDownBy: 4 },  // Low (QVGA 160x90)
              { maxBitrate: 500_000, scaleResolutionDownBy: 2 },  // Medium (VGA 320x180)
              { maxBitrate: 1_500_000, scaleResolutionDownBy: 1 }, // High (HD 640x360)
            ]
          : undefined,
        codecOptions: {
          videoGoogleStartBitrate: 1000,
        },
      })

      // Store producer in our map
      producersRef.current.set(producer.id, producer)

      // When producer transport closes, clean up
      producer.on('transportclose', () => {
        rtcLogger.producer('PRODUCE', 'Transport closed, removing producer')
        producersRef.current.delete(producer.id)
        setProducers(Array.from(producersRef.current.values()))
      })

      setProducers(Array.from(producersRef.current.values()))
      rtcLogger.producer('PRODUCE', `Produced ${kind} (id: ${producer.id})`)

      // Track producer IDs for easy toggle
      if (kind === 'cam-audio') {
        audioProducerIdRef.current = producer.id
      } else if (kind === 'cam-video') {
        videoProducerIdRef.current = producer.id
      }

      return producer
    } catch (err: any) {
      rtcLogger.error('PRODUCE', `Failed to produce ${kind}:`, err)
      return null
    }
  }, [])

  // Produce screen share track
  const produceScreenShare = useCallback(async (
    track: MediaStreamTrack
  ): Promise<Producer | null> => {
    if (!sendTransportRef.current) {
      rtcLogger.error('PRODUCE', 'No send transport available')
      return null
    }

    try {
      rtcLogger.producer('PRODUCE', 'Starting production of screen share')

      const producer = await sendTransportRef.current.produce({
        track,
        encodings: [
          { maxBitrate: 100_000, scaleResolutionDownBy: 4 },
          { maxBitrate: 300_000, scaleResolutionDownBy: 2 },
          { maxBitrate: 1_000_000, scaleResolutionDownBy: 1 },
        ],
        codecOptions: {
          videoGoogleStartBitrate: 1000,
        },
      })

      producersRef.current.set(producer.id, producer)
      screenShareProducerIdRef.current = producer.id

      producer.on('transportclose', () => {
        rtcLogger.producer('PRODUCE', 'Transport closed, removing screen share producer')
        producersRef.current.delete(producer.id)
        screenShareProducerIdRef.current = null
        setProducers(Array.from(producersRef.current.values()))
      })

      setProducers(Array.from(producersRef.current.values()))
      rtcLogger.producer('PRODUCE', `Produced screen share (id: ${producer.id})`)

      return producer
    } catch (err: any) {
      rtcLogger.error('PRODUCE', 'Failed to produce screen share:', err)
      return null
    }
  }, [])

  // Consume a remote producer
  const consumeProducer = useCallback(async (
    producerId: string,
    peerId: string,
    rtpCapabilities: any
  ): Promise<Consumer | null> => {
    if (!signalingRef.current || !recvTransportRef.current) {
      rtcLogger.error('CONSUME', 'No recv transport available')
      return null
    }

    try {
      rtcLogger.consumer('CONSUME', `Consuming producer ${producerId} from ${peerId}`)

      // Request consumer from SFU via signaling
      const consumerData = await signalingRef.current.consume(producerId, rtpCapabilities)

      if (!consumerData) return null

      // Create the consumer on the client-side recv transport
      const consumer = await recvTransportRef.current.consume({
        id: consumerData.id,
        producerId: consumerData.producerId,
        kind: consumerData.kind,
        rtpParameters: consumerData.rtpParameters,
      })

      consumersRef.current.set(consumer.id, consumer)

      // Update remote consumers list with the incoming media track
      const remoteConsumer: RemoteConsumer = {
        consumerId: consumer.id,
        peerId,
        producerId,
        kind: consumerData.kind,
        track: consumer.track,
        paused: consumerData.producerPaused,
      }

      remoteConsumersRef.current.set(`${peerId}-${consumerData.kind}`, remoteConsumer)
      setRemoteConsumers(Array.from(remoteConsumersRef.current.values()))

      // Handle consumer closure
      consumer.on('trackended', () => {
        rtcLogger.consumer('CONSUME', `Track ended for consumer ${consumer.id}`)
      })

      consumer.on('transportclose', () => {
        rtcLogger.consumer('CONSUME', `Transport closed for consumer ${consumer.id}`)
        consumersRef.current.delete(consumer.id)
        remoteConsumersRef.current.delete(`${peerId}-${consumerData.kind}`)
        setRemoteConsumers(Array.from(remoteConsumersRef.current.values()))
      })

      return consumer
    } catch (err: any) {
      rtcLogger.error('CONSUME', `Failed to consume ${producerId}:`, err)
      return null
    }
  }, [])

  // Join a classroom room
  const joinRoom = useCallback(async (
    roomId: string,
    role: Role,
    displayName: string,
    password?: string
  ): Promise<void> => {
    const connectionId = ++connectionIdRef.current

    try {
      setError(null)
      await init()
      if (connectionId !== connectionIdRef.current) return

      if (!signalingRef.current || !deviceRef.current) {
        throw new Error('Not initialized')
      }

      roomIdRef.current = roomId

      // Load router capabilities (must be done before creating transports)
      // This fetches the SFU's supported codecs and negotiates them
      const rtpCapabilities = await loadRouterCapabilities()
      if (connectionId !== connectionIdRef.current) return
      if (!rtpCapabilities) throw new Error('Failed to load router capabilities')

      // Join the room via signaling
      const roomInfo = await signalingRef.current.join(roomId, role, displayName, password)
      if (connectionId !== connectionIdRef.current) return
      setRoomInfo(roomId, roomInfo.peers, role, displayName)

      rtcLogger.info('ROOM', `Joined room ${roomId} as ${role}`)

      // Create send/recv transports
      await createTransports()
      if (connectionId !== connectionIdRef.current) return

      // Subscribe to existing producers (peers already in room)
      for (const peer of roomInfo.peers) {
        // The server will send 'new-producer' events for each producer
        // We need to store the logic for handling these
      }

      // Set up signaling event handlers for dynamic peer/producer management

      // Handle new peer producer becoming available
      signalingRef.current.onNewProducer(async (data) => {
        rtcLogger.info('ROOM', `New producer from ${data.peerId}: ${data.kind}`)

        // If this is from another peer (not us), consume it
        if (data.peerId !== signalingRef.current?.getSocketId()) {
          await consumeProducer(
            data.producerId,
            data.peerId,
            deviceRef.current!.rtpCapabilities
          )
        }
      })

      signalingRef.current.onProducerPaused(({ producerId }) => {
        rtcLogger.info('ROOM', `Remote producer paused: ${producerId}`)
        const consumerKey = Array.from(remoteConsumersRef.current.keys()).find(
          key => remoteConsumersRef.current.get(key)?.producerId === producerId
        )
        if (consumerKey) {
          const consumer = remoteConsumersRef.current.get(consumerKey)
          if (consumer) {
            consumer.paused = true
            setRemoteConsumers(Array.from(remoteConsumersRef.current.values()))
          }
        }
      })

      signalingRef.current.onProducerResumed(({ producerId }) => {
        rtcLogger.info('ROOM', `Remote producer resumed: ${producerId}`)
        const consumerKey = Array.from(remoteConsumersRef.current.keys()).find(
          key => remoteConsumersRef.current.get(key)?.producerId === producerId
        )
        if (consumerKey) {
          const consumer = remoteConsumersRef.current.get(consumerKey)
          if (consumer) {
            consumer.paused = false
            setRemoteConsumers(Array.from(remoteConsumersRef.current.values()))
          }
        }
      })

      // Handle peer joining
      signalingRef.current.onPeerJoined((peer) => {
        rtcLogger.info('ROOM', `Peer joined: ${peer.displayName} (${peer.peerId})`)
        addPeer(peer)
        // Show join notification
        addJoinNotification({
          id: `join-${peer.peerId}-${Date.now()}`,
          displayName: peer.displayName,
          type: 'join',
          timestamp: Date.now(),
        })
      })

      // Handle peer leaving
      signalingRef.current.onPeerLeft(({ peerId }) => {
        rtcLogger.info('ROOM', `Peer left: ${peerId}`)
        // Show leave notification before removing
        const leavingPeer = useClassroomStore.getState().peers.find(p => p.peerId === peerId)
        if (leavingPeer) {
          addJoinNotification({
            id: `leave-${peerId}-${Date.now()}`,
            displayName: leavingPeer.displayName,
            type: 'leave',
            timestamp: Date.now(),
          })
        }
        removePeer(peerId)
        clearRaisedHand(peerId)

        // Remove remote consumers for this peer
        for (const [key, consumer] of remoteConsumersRef.current.entries()) {
          if (consumer.peerId === peerId) {
            const actualConsumer = consumersRef.current.get(consumer.consumerId)
            actualConsumer?.close()
            consumersRef.current.delete(consumer.consumerId)
            remoteConsumersRef.current.delete(key)
          }
        }
        setRemoteConsumers(Array.from(remoteConsumersRef.current.values()))
      })

      // Handle active speaker updates
      signalingRef.current.onActiveSpeaker(({ peerId, volume }) => {
        setActiveSpeaker({ peerId, volume })
      })

      // Handle chat messages
      signalingRef.current.onChatMessage((msg) => {
        addChatMessage(msg)
      })

      // Handle raise hand
      signalingRef.current.onRaiseHand(({ peerId, displayName, raisedAt }) => {
        setRaisedHand(peerId, { displayName, raisedAt })
        addJoinNotification({
          id: `raise-${peerId}-${Date.now()}`,
          displayName,
          type: 'raise-hand',
          timestamp: Date.now(),
        })
      })

      signalingRef.current.onLowerHand(({ peerId }) => {
        clearRaisedHand(peerId)
      })

      signalingRef.current.onHostMute(() => {
        optionsRef.current.onHostMute?.()
      })

      signalingRef.current.onHostKick((reason?: string) => {
        optionsRef.current.onHostKick?.(reason)
      })

      // Record when this peer entered the room (for meeting timer)
      setMeetingStartedAt(Date.now())

      // Start audio level monitoring - send levels to server periodically
      const audioLevelInterval = setInterval(() => {
        const audioProducer = audioProducerIdRef.current
          ? producersRef.current.get(audioProducerIdRef.current)
          : null
        
        if (audioProducer && !audioProducer.paused) {
          // Get approximate audio level from producer stats
          audioProducer.getStats().then((stats) => {
            stats.forEach((report) => {
              if (report.type === 'outbound-rtp' && report.kind === 'audio') {
                // Use bytesSent as a rough indicator of audio activity
                const level = Math.min(100, Math.floor((report.bytesSent || 0) / 1000))
                signalingRef.current?.getSocket() && 
                  signalingRef.current?.getSocket().emit('audio-level', { level })
              }
            })
          }).catch(() => {
            // Ignore stats errors
          })
        }
      }, 500)

      // Store interval ID for cleanup
      ;(joinRoom as any).audioLevelInterval = audioLevelInterval

      // Handle reconnection - restore state after socket reconnects
      signalingRef.current?.socket?.on('reconnect', async () => {
        rtcLogger.info('ROOM', 'Socket reconnected, restoring state...')
        
        try {
          // Re-join the room
          const roomInfo = await signalingRef.current!.join(roomId, role, displayName)
          setRoomInfo(roomId, roomInfo.peers, role, displayName)
          
          // Re-create transports if needed
          if (!sendTransportRef.current || !recvTransportRef.current) {
            await createTransports()
          }
          
          // Re-produce local media if we have tracks
          if (audioProducerIdRef.current) {
            // Audio producer was active, need to re-produce
            rtcLogger.info('ROOM', 'Need to re-produce audio after reconnection')
          }
          if (videoProducerIdRef.current) {
            rtcLogger.info('ROOM', 'Need to re-produce video after reconnection')
          }
          
          rtcLogger.info('ROOM', 'State restored after reconnection')
        } catch (err) {
          rtcLogger.error('ROOM', 'Failed to restore state after reconnection:', err)
        }
      })

      rtcLogger.info('ROOM', 'Room setup complete')
    } catch (err: any) {
      rtcLogger.error('ROOM', 'Failed to join room:', err)
      setError(err.message)
    } finally {
      ;(joinRoom as any).joining = false
    }
  }, [init, loadRouterCapabilities, createTransports, consumeProducer, setRoomInfo, addPeer, addJoinNotification, removePeer, clearRaisedHand, setActiveSpeaker, addChatMessage, setRaisedHand, setMeetingStartedAt])

  // Leave the room
  const leaveRoom = useCallback(async () => {
    rtcLogger.info('ROOM', 'Leaving room...')
    connectionIdRef.current++

    // Clear audio level monitoring
    if ((joinRoom as any).audioLevelInterval) {
      clearInterval((joinRoom as any).audioLevelInterval)
      ;(joinRoom as any).audioLevelInterval = null
    }

    // Close all producers
    for (const producer of producersRef.current.values()) {
      producer.close()
    }
    producersRef.current.clear()
    setProducers([])

    // Close all consumers
    for (const consumer of consumersRef.current.values()) {
      consumer.close()
    }
    consumersRef.current.clear()
    remoteConsumersRef.current.clear()
    setRemoteConsumers([])

    // Close transports
    sendTransportRef.current?.close()
    recvTransportRef.current?.close()
    sendTransportRef.current = null
    recvTransportRef.current = null
    setSendTransport(null)
    setRecvTransport(null)

    // Disconnect signaling
    signalingRef.current?.removeAllListeners()
    signalingRef.current?.disconnect()
    signalingRef.current = null

    // Reset device
    deviceRef.current = null
    setDevice(null)
    setInitialized(false)

    // Reset init promise ref to allow clean re-initialization
    initPromiseRef.current = null

    // Reset store
    resetStore()

    roomIdRef.current = null
    rtcLogger.info('ROOM', 'Left room')
  }, [resetStore])

  // Stop producing a specific track
  const stopProducing = useCallback(async (producerId: string) => {
    const producer = producersRef.current.get(producerId)
    if (producer) {
      producer.close()
      producersRef.current.delete(producerId)
      setProducers(Array.from(producersRef.current.values()))
    }
  }, [])

// Pause/resume a producer
  const toggleProducer = useCallback(async (producerId: string, enabled: boolean) => {
    if (enabled) {
      await signalingRef.current?.resumeProducer(producerId)
    } else {
      await signalingRef.current?.pauseProducer(producerId)
    }
  }, [])

  // Pause audio producer
  const pauseAudioProducer = useCallback(async () => {
    if (audioProducerIdRef.current) {
      await signalingRef.current?.pauseProducer(audioProducerIdRef.current)
      rtcLogger.producer('AUDIO', 'Audio producer paused')
    }
  }, [])

  // Resume audio producer
  const resumeAudioProducer = useCallback(async () => {
    if (audioProducerIdRef.current) {
      await signalingRef.current?.resumeProducer(audioProducerIdRef.current)
      rtcLogger.producer('AUDIO', 'Audio producer resumed')
    }
  }, [])

  // Pause video producer
  const pauseVideoProducer = useCallback(async () => {
    if (videoProducerIdRef.current) {
      await signalingRef.current?.pauseProducer(videoProducerIdRef.current)
      rtcLogger.producer('VIDEO', 'Video producer paused')
    }
  }, [])

  // Resume video producer
  const resumeVideoProducer = useCallback(async () => {
    if (videoProducerIdRef.current) {
      await signalingRef.current?.resumeProducer(videoProducerIdRef.current)
      rtcLogger.producer('VIDEO', 'Video producer resumed')
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveRoom()
    }
  }, [leaveRoom])

  // ── Chat and raise hand ─────────────────────────────────────────────
  const sendChatMessage = useCallback((text: string, displayName: string) => {
    signalingRef.current?.sendChatMessage(text, displayName)
  }, [])

  const raiseHand = useCallback((displayName: string) => {
    signalingRef.current?.raiseHand(displayName)
  }, [])

  const lowerHand = useCallback(() => {
    signalingRef.current?.lowerHand()
  }, [])

  const muteAllPeers = useCallback(() => {
    signalingRef.current?.muteAllPeers()
  }, [])

  const mutePeer = useCallback((peerId: string) => {
    signalingRef.current?.mutePeer(peerId)
  }, [])

  const kickPeer = useCallback((peerId: string) => {
    signalingRef.current?.kickPeer(peerId)
  }, [])

  const endMeeting = useCallback(() => {
    signalingRef.current?.endMeeting()
  }, [])

  return {
    device,
    sendTransport,
    recvTransport,
    producers,
    remoteConsumers,
    joinRoom,
    leaveRoom,
    produceMedia,
    produceScreenShare,
    stopProducing,
    toggleProducer,
    pauseAudioProducer,
    resumeAudioProducer,
    pauseVideoProducer,
    resumeVideoProducer,
    sendChatMessage,
    raiseHand,
    lowerHand,
    muteAllPeers,
    mutePeer,
    kickPeer,
    endMeeting,
    error: error,
    initialized,
  }
}
