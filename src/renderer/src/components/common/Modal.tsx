import type {
  ReactNode
} from 'react'

interface ModalProps {
  title: string
  close: () => void
  children: ReactNode
}

export function Modal({
  title,
  close,
  children
}: ModalProps) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          close()
        }
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <h2>
            {title}
          </h2>

          <button
            onClick={close}
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}
