import { useCallback, useEffect, useRef, useState } from 'react'
import { LocalVideoTrack, RemoteVideoTrack, Room, RoomEvent, Track } from 'livekit-client'
import type { ScreenShareProfile, ScreenShareQuality, ScreenSource, User } from '../types/concord'

interface UseScreenShareOptions { livekitRoom: Room | null; voiceConnected: boolean; user: User | null }

export const SCREEN_SHARE_PROFILES: ScreenShareProfile[] = [
  { id: 'performance', label: 'Desempenho', detail: '720p • 30 FPS • ideal para jogos pesados', width: 1280, height: 720, frameRate: 30, maxBitrate: 2_500_000 },
  { id: 'balanced', label: 'Balanceado', detail: '1080p • 30 FPS • recomendado', width: 1920, height: 1080, frameRate: 30, maxBitrate: 4_500_000 },
  { id: 'quality', label: 'Fluido', detail: '1080p • 60 FPS', width: 1920, height: 1080, frameRate: 60, maxBitrate: 7_500_000 },
  { id: 'ultra', label: 'Máxima qualidade', detail: '1440p • 60 FPS • exige mais do PC/rede', width: 2560, height: 1440, frameRate: 60, maxBitrate: 12_000_000 }
]

export function useScreenShare({ livekitRoom, voiceConnected, user }: UseScreenShareOptions) {
  const [screenSources, setScreenSources] = useState<ScreenSource[]>([])
  const [showScreenPicker, setShowScreenPicker] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)
  const [screenShareStarting, setScreenShareStarting] = useState(false)
  const [screenTrack, setScreenTrack] = useState<RemoteVideoTrack | LocalVideoTrack | null>(null)
  const [screenSharerName, setScreenSharerName] = useState('')
  const [screenSharerIdentity, setScreenSharerIdentity] = useState('')
  const [screenQuality, setScreenQuality] = useState<ScreenShareQuality>(() => (localStorage.getItem('concord-screen-quality') as ScreenShareQuality) || 'balanced')
  const screenVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!livekitRoom) { setScreenSharing(false); setScreenTrack(null); setScreenSharerName(''); setScreenSharerIdentity(''); return }
    const subscribed = (track: any, publication: any, participant: any) => {
      if (track instanceof RemoteVideoTrack && publication.source === Track.Source.ScreenShare) {
        setScreenTrack(track); setScreenSharerName(participant.name || participant.identity); setScreenSharerIdentity(participant.identity)
      }
    }
    const unsubscribed = (track: any, publication: any) => {
      if (track instanceof RemoteVideoTrack && publication.source === Track.Source.ScreenShare) { setScreenTrack(null); setScreenSharerName(''); setScreenSharerIdentity('') }
    }
    const localUnpublished = (publication: any) => {
      if (publication.source === Track.Source.ScreenShare) { setScreenSharing(false); setScreenTrack(null); setScreenSharerName(''); setScreenSharerIdentity('') }
    }
    const disconnected = () => { setScreenSharing(false); setScreenTrack(null); setScreenSharerName(''); setScreenSharerIdentity(''); setShowScreenPicker(false) }
    livekitRoom.remoteParticipants.forEach((participant) => {
      const track = participant.getTrackPublication(Track.Source.ScreenShare)?.track
      if (track instanceof RemoteVideoTrack) { setScreenTrack(track); setScreenSharerName(participant.name || participant.identity); setScreenSharerIdentity(participant.identity) }
    })
    livekitRoom.on(RoomEvent.TrackSubscribed, subscribed); livekitRoom.on(RoomEvent.TrackUnsubscribed, unsubscribed); livekitRoom.on(RoomEvent.LocalTrackUnpublished, localUnpublished); livekitRoom.on(RoomEvent.Disconnected, disconnected)
    return () => { livekitRoom.off(RoomEvent.TrackSubscribed, subscribed); livekitRoom.off(RoomEvent.TrackUnsubscribed, unsubscribed); livekitRoom.off(RoomEvent.LocalTrackUnpublished, localUnpublished); livekitRoom.off(RoomEvent.Disconnected, disconnected) }
  }, [livekitRoom])

  const openScreenPicker = useCallback(async () => {
    if (!livekitRoom || !voiceConnected) return
    try { setScreenSources(await window.concord.screenShare.getSources()); setShowScreenPicker(true) } catch (error) { console.error(error) }
  }, [livekitRoom, voiceConnected])

  const startScreenShare = useCallback(async (source: ScreenSource, quality: ScreenShareQuality = screenQuality) => {
    if (!livekitRoom) return
    const profile = SCREEN_SHARE_PROFILES.find((item) => item.id === quality) || SCREEN_SHARE_PROFILES[1]
    try {
      setScreenShareStarting(true); setScreenQuality(quality); localStorage.setItem('concord-screen-quality', quality)
      await window.concord.screenShare.selectSource(source.id)
      const publication = await livekitRoom.localParticipant.setScreenShareEnabled(true, {
        audio: true, video: true, contentHint: 'motion', systemAudio: 'include',
        resolution: { width: profile.width, height: profile.height, frameRate: profile.frameRate }
      }, {
        simulcast: true,
        screenShareEncoding: { maxBitrate: profile.maxBitrate, maxFramerate: profile.frameRate, priority: 'high' }
      })
      if (publication?.track instanceof LocalVideoTrack) setScreenTrack(publication.track)
      setScreenSharing(true); setScreenSharerName(user?.displayName || 'Você'); setScreenSharerIdentity(livekitRoom.localParticipant.identity); setShowScreenPicker(false)
    } catch (error) { console.error(error); alert(error instanceof Error ? error.message : 'Não foi possível iniciar o compartilhamento.') }
    finally { setScreenShareStarting(false) }
  }, [livekitRoom, screenQuality, user?.displayName])

  const stopScreenShare = useCallback(async () => {
    if (!livekitRoom) return
    await livekitRoom.localParticipant.setScreenShareEnabled(false); await window.concord.screenShare.clearSource()
    setScreenSharing(false); setScreenTrack(null); setScreenSharerName(''); setScreenSharerIdentity('')
  }, [livekitRoom])

  const cleanupBeforeDisconnect = useCallback(async () => {
    if (livekitRoom && screenSharing) { try { await livekitRoom.localParticipant.setScreenShareEnabled(false) } catch {} }
    try { await window.concord.screenShare.clearSource() } catch {}
    setScreenSharing(false); setScreenTrack(null); setScreenSharerName(''); setScreenSharerIdentity(''); setShowScreenPicker(false)
  }, [livekitRoom, screenSharing])

  return { screenSources, showScreenPicker, setShowScreenPicker, screenSharing, screenShareStarting, screenTrack, screenSharerName, screenSharerIdentity, screenQuality, screenVideoRef, openScreenPicker, startScreenShare, stopScreenShare, cleanupBeforeDisconnect }
}
