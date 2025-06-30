/**
 * Assert given value is not nullish (null or undefined).
 *
 * Borrowed from rust for satisfying typescript checker.
 */
export function unwrap<T>(
  value: T,
  message: string = "Tried to unwrap a nullish value",
): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }

  return value;
}
