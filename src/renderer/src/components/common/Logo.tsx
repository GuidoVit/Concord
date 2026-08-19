import { Mascot } from './Mascot'

export function Logo() {
  return (
    <div className="logo">
      <div className="logo-mascot">
        <Mascot alt="Mascote Harmony" />
      </div>

      <div>
        <strong>
          Harmony
        </strong>

        <span>
          PLAY • TALK • SHARE
        </span>
      </div>
    </div>
  )
}
