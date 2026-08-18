import { useState } from 'react'
import type { ScreenShareQuality, ScreenSource } from '../../types/concord'
import { SCREEN_SHARE_PROFILES } from '../../hooks/useScreenShare'
import { Modal } from '../common/Modal'

interface Props { sources: ScreenSource[]; starting: boolean; close: () => void; start: (source: ScreenSource, quality: ScreenShareQuality) => void }
export function ScreenSharePicker({ sources, starting, close, start }: Props) {
  const [quality, setQuality] = useState<ScreenShareQuality>(() => (localStorage.getItem('concord-screen-quality') as ScreenShareQuality) || 'balanced')
  return <Modal title="O que você quer compartilhar?" close={close}>
    <p>Escolha uma tela, janela ou jogo.</p>
    <div className="screen-quality-picker"><span>Qualidade</span><div className="quality-options">{SCREEN_SHARE_PROFILES.map((profile) => <button key={profile.id} type="button" className={quality === profile.id ? 'quality-option active' : 'quality-option'} onClick={() => setQuality(profile.id)}><strong>{profile.label}</strong><small>{profile.detail}</small></button>)}</div></div>
    <div className="screen-source-grid">{sources.map((source) => <button key={source.id} className="screen-source-card" disabled={starting} onClick={() => start(source, quality)}><div className="screen-source-preview"><img src={source.thumbnail} alt={source.name} /></div><div className="screen-source-name">{source.appIcon && <img src={source.appIcon} alt="" />}<span>{source.name}</span></div></button>)}</div>
  </Modal>
}
