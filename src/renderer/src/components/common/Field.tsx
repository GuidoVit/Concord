interface FieldProps {
  label: string
  value: string
  setValue: (value: string) => void
  placeholder: string
  type?: string
  prefix?: string
}

export function Field({
  label,
  value,
  setValue,
  placeholder,
  type = 'text',
  prefix
}: FieldProps) {
  return (
    <label className="field">
      <span>
        {label}
      </span>

      <div className="field-inner">
        {prefix && (
          <b>
            {prefix}
          </b>
        )}

        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) =>
            setValue(
              event.target.value
            )
          }
        />
      </div>
    </label>
  )
}
