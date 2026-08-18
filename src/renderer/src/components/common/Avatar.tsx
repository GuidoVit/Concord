interface AvatarProps {
  name: string
  image?: string
}

export function Avatar({
  name,
  image
}: AvatarProps) {
  return (
    <div className="avatar">
      {image ? (
        <img
          src={image}
          alt={name}
        />
      ) : (
        name
          .charAt(0)
          .toUpperCase()
      )}
    </div>
  )
}
