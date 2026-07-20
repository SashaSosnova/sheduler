/** Parent-mode PIN — not a server secret, just a kid gate on this device. */
export const PARENT_PIN = '2811'

export function isParentPinValid(input: string): boolean {
  return input.trim() === PARENT_PIN
}
