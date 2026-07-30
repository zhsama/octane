import { Position } from '@xyflow/system';
import { SmartEdge } from '@octanejs/xyflow-smart-edge';
import type { NodeBase, SmartEdgeFallbackProps, SmartEdgeProps } from '@octanejs/xyflow-smart-edge';

export type TestNode = NodeBase<Record<string, unknown>>;
export type SceneProps = SmartEdgeProps<any, TestNode>;

export const SERVER_NODES: TestNode[] = [
	{
		id: 'source',
		data: {},
		position: { x: 40, y: 60 },
		origin: [0.5, 0],
		width: 80,
		height: 40,
	},
	{
		id: 'obstacle',
		data: {},
		position: { x: 170, y: 30 },
		origin: [0.5, 0],
		initialWidth: 80,
		initialHeight: 100,
	},
	{
		id: 'target',
		data: {},
		position: { x: 320, y: 60 },
		origin: [0.5, 0],
		width: 80,
		height: 40,
	},
];

export const SERVER_PROPS: SceneProps = {
	id: 'server-edge',
	source: 'source',
	target: 'target',
	sourceX: 80,
	sourceY: 80,
	targetX: 280,
	targetY: 80,
	sourcePosition: Position.Right,
	targetPosition: Position.Left,
	nodes: SERVER_NODES,
	options: { gridRatio: 10, nodePadding: 20 },
	interactionWidth: 24,
	label: 'route',
	markerEnd: 'url(#arrow)',
	style: { stroke: 'purple', strokeWidth: 3 },
};

export function EdgeScene(props: SceneProps) @{
	<svg id="edge-scene" viewBox="0 0 400 200">
		<g>
			<SmartEdge {...props} />
		</g>
	</svg>
}

export function SiblingScene(props: {
	first: SceneProps;
	second: SceneProps;
}) @{
	<svg id="sibling-scene" viewBox="0 0 600 300">
		<g data-edge="first">
			<SmartEdge {...props.first} />
		</g>
		<g data-edge="second">
			<SmartEdge {...props.second} />
		</g>
	</svg>
}

export function CustomFallback(props: SmartEdgeFallbackProps) @{
	<path className="custom-fallback" d={props.path} data-edge-id={props.id} fill="none" />
}

export function ServerScene(props: SceneProps) @{
	<EdgeScene {...props} />
}
