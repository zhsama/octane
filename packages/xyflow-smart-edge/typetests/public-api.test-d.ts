import { Position } from '@xyflow/system';
import type { Edge, EdgeProps, Node } from '@xyflow/react';
import {
	getSmartEdge,
	pathfindingJumpPointNoDiagonal,
	SmartEdge,
	svgDrawSmoothStepLinePath,
	type SmartEdgeOptions,
	type SmartEdgeProps,
} from '../src/index.js';

type CanvasNode = Node<{ title: string }, 'canvas-node'>;
type CanvasEdge = Edge<{ variant: 'assistant' }, 'canvas-edge'>;

declare const edgeProps: EdgeProps<CanvasEdge>;
declare const nodes: CanvasNode[];

const options = {
	drawEdge: svgDrawSmoothStepLinePath({ borderRadius: 10 }),
	generatePath: pathfindingJumpPointNoDiagonal,
	gridRatio: 8,
	nodePadding: 24,
} satisfies SmartEdgeOptions;

const unsupportedOptions: SmartEdgeOptions = {
	// @ts-expect-error Editable edges require the future Octane XYFlow integration.
	editable: true,
};

const props: SmartEdgeProps<CanvasEdge, CanvasNode> = {
	...edgeProps,
	nodes,
	options,
	sourcePosition: Position.Bottom,
	targetPosition: Position.Top,
};

const configured = SmartEdge<CanvasEdge, CanvasNode>;
void configured;
void props;
void unsupportedOptions;

const route = getSmartEdge({
	nodes,
	options,
	sourceX: 0,
	sourceY: 10,
	targetX: 100,
	targetY: 110,
	sourcePosition: Position.Bottom,
	targetPosition: Position.Top,
});
if (!(route instanceof Error)) {
	const path: string = route.svgPathString;
	const center: number = route.edgeCenterX;
	void path;
	void center;
}
