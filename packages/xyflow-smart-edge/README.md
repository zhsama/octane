# @octanejs/xyflow-smart-edge

Octane binding for the obstacle-avoiding core and explicit-node `SmartEdge`
surface of `@tisoap/react-flow-smart-edge@4.13.0`.

## Install

```bash
pnpm add @octanejs/xyflow-smart-edge @xyflow/system
```

No React runtime or `@xyflow/react` peer is installed. Pass the nodes already
owned by your flow renderer:

```tsrx
import { Position } from '@xyflow/system';
import {
	SmartEdge,
	pathfindingJumpPointNoDiagonal,
	svgDrawSmoothStepLinePath,
} from '@octanejs/xyflow-smart-edge';

const options = {
	drawEdge: svgDrawSmoothStepLinePath({ borderRadius: 10 }),
	generatePath: pathfindingJumpPointNoDiagonal,
	gridRatio: 8,
	nodePadding: 24,
};

export function RoutedEdge(props: EdgeProps) @{
	<SmartEdge
		{...props}
		interactionWidth={20}
		nodes={props.nodes}
		options={options}
		sourcePosition={Position.Bottom}
		targetPosition={Position.Top}
	/>
}
```

`SmartEdge` renders the visible edge path, transparent interaction path,
markers, style, and optional SVG label. Routing failures use a framework-neutral
Bezier fallback unless an Octane fallback component is supplied.

## Supported core

- A* diagonal and orthogonal pathfinding, plus orthogonal jump-point search
- obstacle grids, node/avoid-area bounds, endpoint alignment, and subflow
  coordinate preparation
- XYFlow dimension precedence (`measured`, `width`/`height`, then initial
  dimensions) and per-node origins, including nested subflows
- straight, rounded, smooth-step, and simple-Bezier SVG drawing
- `getSmartEdge`, `getSmartEdgeWaypoints`, and floating-edge geometry helpers
- a bounded shared obstacle cache whose mutable search grid is cloned per edge
  and whose structured key cannot collide with consumer node ids

## Deliberate scope

The upstream editable control points, circuit hops, Web Worker batch provider,
React Flow hooks/store integration, and preset components need a real Octane
XYFlow binding. They are not exposed as inert compatibility props here.
