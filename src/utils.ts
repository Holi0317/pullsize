export function unwrap<T>(value: T): NonNullable<T> {
  if (value == null) {
    throw new Error("Tried to unwrap a nullish value");
  }

  return value;
}
