import type { DtlsParameters, IceCandidate, IceParameters } from 'mediasoup-client/types'

export type Role = 'teacher' | 'student'

export interface PeerInfo {
  peerId: string
  displayName: string
  role: Role
  joinedAt: number
}

export interface RoomInfo {
  roomId: string
  peers: PeerInfo[]
}

export interface MeetingInfo {
  meetingId: string
  roomId: string
  createdAt: number
  status: 'active' | 'ended'
  password?: string
  participantCount?: number
}

export interface ChatMessage {
  id: string
  peerId: string
  displayName: string
  text: string
  timestamp: number
}

export interface RaisedHand {
  peerId: string
  displayName: string
  raisedAt: number
}

export interface JoinNotification {
  id: string
  displayName: string
  type: 'join' | 'leave' | 'raise-hand'
  timestamp: number
}

export interface MediaTrack {
  peerId: string
  kind: 'audio' | 'video'
  producerId: string
  paused: boolean
}

export type ProducerKind = 'cam-video' | 'cam-audio' | 'screen-video' | 'screen-audio'

export interface TransportCreatedEvent {
  transportId: string
  iceParameters: IceParameters
  iceCandidates: IceCandidate[]
  dtlsParameters: {
    fingerprint: any
    role: 'auto' | 'client' | 'server'
  }
}

export interface ProducerCreatedEvent {
  id: string
  kind: 'audio' | 'video'
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

export interface ActiveSpeaker {
  peerId: string
  volume: number
}

export type MediaState = 'enabled' | 'disabled' | 'off'

export interface LocalMediaState {
  video: MediaState
  audio: MediaState
  screen: boolean
}

export type SignallingMessage =
  | { type: 'join'; roomId: string; role: Role; displayName: string }
  | { type: 'joined'; info: RoomInfo }
  | { type: 'error'; message: string }
  | { type: 'peer-joined'; peer: PeerInfo }
  | { type: 'peer-left'; peerId: string }
  | { type: 'create-transport'; direction: 'send' | 'recv' }
  | { type: 'transport-created'; direction: 'send' | 'recv'; transport: TransportCreatedEvent }
  | { type: 'connect-transport'; transportId: string; dtlsParameters: DtlsParameters }
  | { type: 'transport-connected'; transportId: string }
  | { type: 'produce'; kind: ProducerKind; rtpParameters: any; transportId: string }
  | { type: 'produced'; id: string; kind: 'audio' | 'video' }
  | { type: 'consume'; producerId: string; transportId: string; rtpCapabilities: any }
  | { type: 'consumed'; consumer: ConsumerCreatedEvent }
  | { type: 'producer-paused'; producerId: string }
  | { type: 'producer-resumed'; producerId: string }
  | { type: 'consumer-paused'; consumerId: string }
  | { type: 'consumer-resumed'; consumerId: string }
  | { type: 'active-speaker'; speaker: ActiveSpeaker }
  | { type: 'resume-consumer'; consumerId: string }
  | { type: 'pause-consumer'; consumerId: string }
