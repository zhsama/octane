---
'@octanejs/xyflow-smart-edge': patch
---

Add an Octane-native binding for `@tisoap/react-flow-smart-edge@4.13.0`.

The package ports the framework-neutral pathfinding, obstacle-grid, bounding-box,
drawing, and bounded-cache pipeline, and renders the Echo-compatible `SmartEdge`
surface as real SVG without a React runtime or an `@xyflow/react` peer.
Obstacle geometry honors XYFlow origins and SSR dimension fallbacks, and cache
keys are collision-safe for arbitrary node ids.
