import * as React from "react"
import { Input } from "./input"

export const FastInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>((props, ref) => {
  const { value, onChange, onBlur, ...rest } = props
  const [localValue, setLocalValue] = React.useState(value || "")

  React.useEffect(() => {
    setLocalValue(value || "")
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (onChange && localValue !== value) {
      // Create a synthetic event to pass to onChange
      const event = {
        ...e,
        target: { ...e.target, value: localValue }
      } as React.ChangeEvent<HTMLInputElement>
      onChange(event)
    }
    if (onBlur) onBlur(e)
  }

  return (
    <Input
      ref={ref}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      {...rest}
    />
  )
})
FastInput.displayName = "FastInput"
