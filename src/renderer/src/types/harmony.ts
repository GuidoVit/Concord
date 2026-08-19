export type AuthMode =
  | 'login'
  | 'register'

export type Screen =
  | 'auth'
  | 'home'
  | 'friends'
  | 'dm'
  | 'server'

export interface User {
  id: string
  username: string
  displayName: string
  createdAt: string
  avatarUrl?: string
}

export interface FriendRequest {
  id: string
  user: User
}

export interface HarmonyServer {
  id: string
  name: string
  ownerId: string
  inviteCode: string
  members: string[]
  iconUrl?: string
  memberRoles?: Record<string, string>

  channels: {
    id: string
    name: string
    type: 'voice' | 'text'
  }[]
}

export interface VoiceParticipant {
  identity: string
  name: string
  username?: string
  isSpeaking: boolean
  avatarUrl?: string
  isLocal?: boolean
  isMuted?: boolean
  isDeafened?: boolean
}

export type ScreenShareQuality = 'performance' | 'balanced' | 'quality' | 'ultra'

export interface ScreenShareProfile {
  id: ScreenShareQuality
  label: string
  detail: string
  width: number
  height: number
  frameRate: number
  maxBitrate: number
}

export interface ScreenSource {
  id: string
  name: string
  thumbnail: string
  appIcon: string | null
}

export type AttachmentKind = 'image' | 'video' | 'sticker'

export interface MessageAttachment {
  kind: AttachmentKind
  dataUrl?: string
  url?: string
  name?: string
  mimeType?: string
  size?: number
}

export interface DirectMessage {
  id: string
  senderId: string
  receiverId: string
  content: string
  attachment?: MessageAttachment | null
  read: boolean
  createdAt: string
}

export interface ServerMessage {
  id: string
  serverId: string
  channelId: string
  authorId: string
  content: string
  attachment?: MessageAttachment | null
  createdAt: string
  author?: User | null
}

export interface Conversation {
  friend: User
  lastMessage: DirectMessage | null
  unread: number
}


export interface UpdaterState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'
  currentVersion: string
  availableVersion?: string
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
  error?: string
}
