export function unwrap<T>(
  value: T,
  message: string = "Tried to unwrap a nullish value",
): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }

  return value;
}
