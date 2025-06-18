import { useEffect, useRef } from 'react'

/**
 * A custom hook that returns the previous value of a variable.
 * @param value The current value.
 * @returns The value from the previous render.
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref.current
}
