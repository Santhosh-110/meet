import { create } from 'zustand'
import type { PeerInfo, Role, MediaState, ActiveSpeaker, MeetingInfo, ChatMessage, RaisedHand, JoinNotification } from '../types/webrtc'

// Zustand store for classroom state
// Keeps state management OUT of React's render cycle,
// preventing unnecessary re-renders when media streams update
//
// Performance design:
// - Separate store slices for different concerns
// - Use selectors to subscribe to only needed state
// - Media streams stored as Map for O(1) lookup

interface ClassroomState {
  // Connection state
  connected: boolean
  peerId: string | null
  roomId: string | null
  role: Role | null
  displayName: string | null

  // Room state
  peers: PeerInfo[]
  activeSpeaker: ActiveSpeaker | null
  mediaState: {
    video: MediaState
    audio: MediaState
    screen: boolean
  }

  // Meeting scheduling
  pendingMeeting: MeetingInfo | null

  // Chat
  chatMessages: ChatMessage[]

  // Raise hand: peerId → RaisedHand
  raisedHands: Record<string, RaisedHand>

  // Join/leave toast notifications
  joinNotifications: JoinNotification[]

  // Meeting timer
  meetingStartedAt: number | null

  // Actions
  setConnected: (connected: boolean) => void
  setPeerInfo: (peerId: string, displayName?: string) => void
  setRoomInfo: (roomId: string, peers: PeerInfo[], role: Role, displayName: string) => void
  addPeer: (peer: PeerInfo) => void
  removePeer: (peerId: string) => void
  setActiveSpeaker: (speaker: ActiveSpeaker | null) => void
  setMediaState: (kind: 'video' | 'audio', state: MediaState) => void
  setScreenShare: (enabled: boolean) => void
  setPendingMeeting: (meeting: MeetingInfo | null) => void
  // Chat actions
  addChatMessage: (msg: ChatMessage) => void
  clearChat: () => void
  // Raise hand actions
  setRaisedHand: (peerId: string, info: Omit<RaisedHand, 'peerId'>) => void
  clearRaisedHand: (peerId: string) => void
  clearAllRaisedHands: () => void
  // Notification actions
  addJoinNotification: (notification: JoinNotification) => void
  dismissJoinNotification: (id: string) => void
  // Timer actions
  setMeetingStartedAt: (ts: number | null) => void
  reset: () => void
}

const initialState = {
  connected: false,
  peerId: null as string | null,
  roomId: null as string | null,
  role: null as Role | null,
  displayName: null as string | null,
  peers: [] as PeerInfo[],
  activeSpeaker: null as ActiveSpeaker | null,
  mediaState: {
    video: 'enabled' as MediaState,
    audio: 'enabled' as MediaState,
    screen: false,
  },
  pendingMeeting: null as MeetingInfo | null,
  chatMessages: [] as ChatMessage[],
  raisedHands: {} as Record<string, RaisedHand>,
  joinNotifications: [] as JoinNotification[],
  meetingStartedAt: null as number | null,
}

export const useClassroomStore = create<ClassroomState>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),

  setPeerInfo: (peerId, displayName) => set({ peerId, displayName }),

  setRoomInfo: (roomId, peers, role, displayName) => set({
    roomId,
    peers,
    role,
    displayName,
    connected: true,
  }),

  addPeer: (peer) => set((state) => ({
    peers: [...state.peers, peer],
  })),

  removePeer: (peerId) => set((state) => ({
    peers: state.peers.filter((p) => p.peerId !== peerId),
  })),

  setActiveSpeaker: (speaker) => set({ activeSpeaker: speaker }),

  setMediaState: (kind, state) => set((prev) => ({
    mediaState: { ...prev.mediaState, [kind]: state },
  })),

  setScreenShare: (enabled) => set((prev) => ({
    mediaState: { ...prev.mediaState, screen: enabled },
  })),

  setPendingMeeting: (meeting) => set({ pendingMeeting: meeting }),

  // ── Chat ──────────────────────────────────────────────────────────────
  addChatMessage: (msg) => set((state) => ({
    chatMessages: [...state.chatMessages, msg],
  })),

  clearChat: () => set({ chatMessages: [] }),

  // ── Raise hand ────────────────────────────────────────────────────────
  setRaisedHand: (peerId, info) => set((state) => ({
    raisedHands: {
      ...state.raisedHands,
      [peerId]: { peerId, ...info },
    },
  })),

  clearRaisedHand: (peerId) => set((state) => {
    const next = { ...state.raisedHands }
    delete next[peerId]
    return { raisedHands: next }
  }),

  clearAllRaisedHands: () => set({ raisedHands: {} }),

  // ── Notifications ─────────────────────────────────────────────────────
  addJoinNotification: (notification) => set((state) => ({
    joinNotifications: [...state.joinNotifications, notification],
  })),

  dismissJoinNotification: (id) => set((state) => ({
    joinNotifications: state.joinNotifications.filter((n) => n.id !== id),
  })),

  // ── Timer ─────────────────────────────────────────────────────────────
  setMeetingStartedAt: (ts) => set({ meetingStartedAt: ts }),

  reset: () => set((state) => ({
    ...initialState,
    mediaState: state.mediaState,
    // Reset mutable objects to fresh instances
    raisedHands: {},
    chatMessages: [],
    joinNotifications: [],
  })),
}))
