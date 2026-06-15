import type { Transport, Producer, Consumer } from 'mediasoup/types'
import type { DtlsParameters, IceCandidate, IceParameters } from 'mediasoup/types'

export type Role = 'teacher' | 'student'

export interface PeerInfo {
  peerId: string
  displayName: string
  role: Role
  joinedAt: number
}

export interface PeerData {
  peerId: string
  displayName: string
  role: Role
  joinedAt: number
  transports: Map<string, Transport>
  producers: Map<string, Producer>
  consumers: Map<string, Consumer>
}

export interface RoomData {
  roomId: string
  peers: Map<string, PeerData>
  createdAt: number
}

export type ProducerKind = 'cam-video' | 'cam-audio' | 'screen-video' | 'screen-audio'

export interface TransportCreatedEvent {
  transportId: string
  iceParameters: IceParameters
  iceCandidates: IceCandidate[]
  dtlsParameters: {
    fingerprint: {
      algorithm: string
      value: string
    }
    role: 'auto' | 'client' | 'server'
  }
}

export interface ConsumerCreatedEvent {
  peerId: string
  producerId: string
  id: string
  kind: 'audio' | 'video'
  rtpParameters: any
  type: string
  producerPaused: boolean
}
