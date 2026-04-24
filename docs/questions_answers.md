Refactor 1 — Panel hiding

Root cause: App.tsx:92 sets sidePanelClass = isCreatingWindmill ? "hidden" : "flex-1 min-w-0" and applies it to the Farm and Parquet panels. Removing the toggle is a 3-line change in App.tsx.

Question: isCreatingWindmill in the store and its setter calls in WindmillPanel.tsx become dead code after this. Should I remove them entirely from the store, or leave them (harmless but unused)?

A:/ The implementation is not about hidding the list of windmills, is about the other windows "Farm management" and "Parquet Files" that are hidden while windmills is being
created/edited.

---

Refactor 2 — Sensor configuration

Bug root cause (crash): The f() handler in both CreateWindmillForm.tsx:78 and EditWindmillForm.tsx:85 converts to Number only when e.target.type === "number". A <input type="range"> has type "range", so the value stays
a string. On re-render, .toFixed() is called on a string → crash. Fix: add || e.target.type === "range" to the condition.

Concept design questions:

The 4 fields per sensor currently have these labels: Clamp Min | Normal Min | Normal Max | Spike Max. The refactor wants "universe" vs "simulation interval" to be clear. Here are layout options:

Option A — Two rows with group headers:
── Physical bounds ──────────────────
Physical Min [ 0 ] Physical Max [ 200 ]
── Simulation interval ──────────────
From [ 35 ] To [ 45 ]
── Variation ────────────────────────
Max step ±2.0% per beat [====●====]

Option B — Single row, renamed labels only:
Floor | Sim Min | Sim Max | Ceiling
[ 0 ] | [ 35 ] | [ 45 ] | [ 200 ]
Max step ±2.0% per beat [====●====]

Option C — Keep the 4-column grid, just rename: Min (floor) | Range from | Range to | Max (spike).

Three more questions:

1. Which layout option (A, B, or C — or something else)?
   A:/ B

2. Should the rate label become ±X% per beat to make bidirectionality explicit?
   A:/ Sure

3. Should Refactor 2 also apply to EditWindmillForm? (It has the same crash bug.)

A:/ Yes.
