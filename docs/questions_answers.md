Q73 — WS broadcast error handling: what happens when send_json raises on a broken connection?

When the stop route iterates active_connections[windmill_id] and calls await ws.send_json(payload) on each entry, one or more of those sockets may already be half-closed
(client tab crashed, network drop, etc.). In that case send_json raises a WebSocketDisconnect or ConnectionClosedError.

Two options:

(a) Catch silently, remove the broken entry

for ws in list(active_connections.get(windmill_id, [])):
try:
await ws.send_json(payload)
except Exception:
active_connections[windmill_id].remove(ws)

The broadcast continues to all remaining connections. The broken entry is cleaned up opportunistically here rather than waiting for the disconnect handler to fire.

(b) Let it raise — the disconnect handler is sufficient

The WS handler already removes entries from active_connections on disconnect. If the client is truly gone, the TCP close will trigger the disconnect handler and remove
it. The stop route makes a best-effort broadcast and does not handle exceptions.

- Pro: simpler stop route.
- Con: a half-open socket (TCP keepalive not yet fired) can cause the broadcast to raise mid-loop, skipping all remaining connections.

Recommendation: (a) — the silent-catch-and-remove is three lines and prevents a broken socket from aborting the broadcast to all remaining connected clients. The
overhead is negligible.

Which do you choose: (a) or (b)?

A:/ (a)
