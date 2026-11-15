export function getEffectiveClientTaskOwnerId(
  currentOwnerId: string,
  activePeople: Array<{ id: string }>,
) {
  return currentOwnerId || activePeople[0]?.id || "";
}
