const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("bj-journal") : null

export const announceWrite = (): void => channel?.postMessage("write")

export function onRemoteWrite(cb: () => void): () => void {
  if (!channel) return () => {}
  const handler = (e: MessageEvent) => { if (e.data === "write") cb() }
  channel.addEventListener("message", handler)
  return () => channel.removeEventListener("message", handler)
}
