import type { User } from '../../types/harmony'
import { Avatar } from '../common/Avatar'

export function FriendCard({
  friend,
  onClick
}: {
  friend:
    User

  onClick?:
    () => void
}) {
  return (
    <button
      className="friend-card"
      onClick={
        onClick
      }
    >
      <Avatar name={friend.displayName} image={friend.avatarUrl} />

      <div>
        <strong>
          {
            friend.displayName
          }
        </strong>

        <span>
          @
          {
            friend.username
          }
        </span>
      </div>

      <div className="online-dot" />

    </button>
  )
}
