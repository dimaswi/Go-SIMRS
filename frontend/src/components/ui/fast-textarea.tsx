import * as React from "react"
import { Textarea } from "./textarea"

export const FastTextarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<typeof Textarea>>((props, ref) => {
  const { value, onChange, onBlur, ...rest } = props
  const [localValue, setLocalValue] = React.useState(value || "")

  React.useEffect(() => {
    setLocalValue(value || "")
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(e.target.value)
  }

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (onChange && localValue !== value) {
      // Create a synthetic event to pass to onChange
      const event = {
        ...e,
        target: { ...e.target, value: localValue }
      } as React.ChangeEvent<HTMLTextAreaElement>
      onChange(event)
    }
    if (onBlur) onBlur(e)
  }

  return (
    <Textarea
      ref={ref}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      {...rest}
    />
  )
})
FastTextarea.displayName = "FastTextarea"
