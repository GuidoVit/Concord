import { Mascot } from './Mascot'

export function Logo() {
  return (
    <div className="logo">
      <div className="logo-mascot">
        <Mascot alt="Mascote Concord" />
      </div>

      <div>
        <strong>
          Concord
        </strong>

        <span>
          PLAY • TALK • SHARE
        </span>
      </div>
    </div>
  )
}
