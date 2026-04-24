Q72 — WebSocket connection registry: mechanism for push-on-stop

When POST /windmills/{id}/stop is called (a REST endpoint), it must push status: stopped to all currently open WebSocket connections for that windmill. The document  
 states this happens but doesn't specify how those connections are tracked or accessed from a REST route.

Three approaches, each with real consequences for the backend structure:

(a) Module-level connection dict in http/

# http/ws_registry.py

active_connections: dict[str, list[WebSocket]] = {}
The WS handler registers/deregisters on connect/disconnect. The stop route imports and reads it directly.

- Pro: Simple, zero boilerplate.
- Con: Technically a module-level singleton (the pattern the conventions say to avoid). However, asyncio single-process guarantees no race conditions without locking.

(b) A ConnectionManager class injected via Depends()
A class wraps the dict. A single instance is created at app startup and injected into both the WS handler and the stop route via dependency injection.

- Pro: Consistent with the "no module-level singletons" convention — the dependency is explicit.
- Con: More boilerplate; the instance is still effectively a singleton, just declared differently.

(c) The task registry is extended to also hold open WS connections per windmill
The existing in-process task registry (already an exception to the no-singleton rule) stores WS connections alongside task handles.

- Pro: Single registry for all per-windmill runtime state.
- Con: Mixes two concerns (asyncio tasks vs. network connections) in one object.

Which approach?

A:/ Which approach is more minimalistic and maintainable, ask me again about this, elaborate more about the functional implications
