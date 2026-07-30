# Upstream

- Repository: https://github.com/tisoap/react-flow-smart-edge
- Tag: `v4.13.0`
- Commit: `85084cef945a2f26fe2e1fedcabc5a51f9970226`
- Package: `@tisoap/react-flow-smart-edge@4.13.0`
- Framework-neutral type/runtime dependency: `@xyflow/system@0.0.78`
- License: MIT

The pathfinding, grid, bounding-box, endpoint-alignment, SVG drawing, subflow,
and shared-grid cache logic is adapted from the pinned upstream source. The
React component and React Flow store boundary is replaced by a compiled Octane
SVG component that consumes the explicit `nodes` prop used by Echo.

Obstacle geometry additionally follows `@xyflow/system`'s dimension precedence
and per-node `origin` semantics. This is required by Echo's `[0.5, 0]` node
origin and corrects the pinned upstream implementation's measured-only,
top-left-origin assumption.
