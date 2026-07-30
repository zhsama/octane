import { getNodeDimensions, getNodePositionWithOrigin, Position } from '@xyflow/system';
import {
	getSmartEdge as getReactSmartEdge,
	getSmartEdgeWaypoints as getReactSmartEdgeWaypoints,
	getEdgePosition as getReactEdgePosition,
	getFloatingEdgeParams as getReactFloatingEdgeParams,
	getNodeIntersection as getReactNodeIntersection,
	pathfindingAStarDiagonal as reactAStarDiagonal,
	pathfindingAStarNoDiagonal as reactAStarNoDiagonal,
	pathfindingJumpPointNoDiagonal as reactJumpPointNoDiagonal,
	svgDrawSimpleBezierLinePath as reactSimpleBezier,
	svgDrawSmoothLinePath as reactSmooth,
	svgDrawSmoothStepLinePath as reactSmoothStep,
	svgDrawStraightLinePath as reactStraight,
} from '@tisoap/react-flow-smart-edge';
import {
	excludeEdgeAncestorNodes,
	getAbsoluteNodes,
	getEdgePosition,
	getFloatingEdgeParams,
	getNodeIntersection,
	getSmartEdge,
	getSmartEdgeWaypoints,
	pathfindingAStarDiagonal,
	pathfindingAStarNoDiagonal,
	pathfindingJumpPointNoDiagonal,
	svgDrawSimpleBezierLinePath,
	svgDrawSmoothLinePath,
	svgDrawSmoothStepLinePath,
	svgDrawStraightLinePath,
	type NodeBase,
} from '@octanejs/xyflow-smart-edge';
import { describe, expect, it } from 'vitest';

const nodes: NodeBase[] = [
	{
		id: 'source',
		data: {},
		position: { x: 0, y: 80 },
		measured: { width: 80, height: 40 },
	},
	{
		id: 'blocker',
		data: {},
		position: { x: 130, y: 45 },
		measured: { width: 80, height: 110 },
	},
	{
		id: 'target',
		data: {},
		position: { x: 300, y: 80 },
		measured: { width: 80, height: 40 },
	},
];

const routeParams = {
	nodes,
	sourceX: 80,
	sourceY: 100,
	targetX: 300,
	targetY: 100,
	sourcePosition: Position.Right,
	targetPosition: Position.Left,
	options: { gridRatio: 10, nodePadding: 20 },
};

describe('framework-neutral routing parity', () => {
	it('matches the pinned upstream route around node obstacles', () => {
		const actual = getSmartEdge(routeParams);
		const upstream = getReactSmartEdge(routeParams as never);
		expect(actual).not.toBeInstanceOf(Error);
		expect(actual).toEqual(upstream);
		expect((actual as Exclude<typeof actual, Error>).points.some(([, y]) => y !== 100)).toBe(true);
	});

	it('matches every supported pathfinder on the same obstacle grid', () => {
		const pathfinders = [
			[pathfindingAStarDiagonal, reactAStarDiagonal],
			[pathfindingAStarNoDiagonal, reactAStarNoDiagonal],
			[pathfindingJumpPointNoDiagonal, reactJumpPointNoDiagonal],
		] as const;
		for (const [actualPathfinder, upstreamPathfinder] of pathfinders) {
			const actual = getSmartEdge({
				...routeParams,
				options: { ...routeParams.options, generatePath: actualPathfinder },
			});
			const upstream = getReactSmartEdge({
				...routeParams,
				options: { ...routeParams.options, generatePath: upstreamPathfinder },
			} as never);
			expect(actual).toEqual(upstream);
		}
	});

	it('tracks node movement and avoid-area option changes by value', () => {
		const initial = getSmartEdge(routeParams);
		const movedNodes = nodes.map((node) =>
			node.id === 'blocker' ? { ...node, position: { x: node.position.x, y: 180 } } : node,
		);
		const movedParams = { ...routeParams, nodes: movedNodes };
		const moved = getSmartEdge(movedParams);
		expect(moved).toEqual(getReactSmartEdge(movedParams as never));
		expect(moved).not.toEqual(initial);

		const avoidParams = {
			...movedParams,
			options: {
				...movedParams.options,
				avoidAreas: [{ x: 140, y: 70, width: 70, height: 60 }],
			},
		};
		const avoided = getSmartEdge(avoidParams);
		expect(avoided).toEqual(getReactSmartEdge(avoidParams as never));
		expect(avoided).not.toEqual(moved);
	});

	it('matches upstream after normalizing XYFlow origin and SSR dimensions', () => {
		const originNodes: NodeBase[] = [
			{
				id: 'source',
				data: {},
				position: { x: 40, y: 80 },
				origin: [0.5, 0],
				width: 80,
				height: 40,
			},
			{
				id: 'blocker',
				data: {},
				position: { x: 294.5, y: 45 },
				origin: [0.5, 0],
				initialWidth: 269,
				initialHeight: 110,
			},
			{
				id: 'target',
				data: {},
				position: { x: 560, y: 80 },
				origin: [0.5, 0],
				width: 80,
				height: 40,
			},
		];
		const normalizedForUpstream = getAbsoluteNodes(originNodes).map((node) => ({
			...node,
			measured: getNodeDimensions(node),
			origin: [0, 0] as const,
			position: getNodePositionWithOrigin(node),
		}));
		expect(normalizedForUpstream[1].position.x).toBe(160);
		const originParams = {
			...routeParams,
			nodes: originNodes,
			targetX: 520,
		};
		const actual = getSmartEdge(originParams);
		const upstream = getReactSmartEdge({
			...originParams,
			nodes: normalizedForUpstream,
		} as never);
		expect(actual).toEqual(upstream);
		expect(actual).not.toBeInstanceOf(Error);
	});

	it('matches every supported SVG drawing strategy', () => {
		const source = { x: 0, y: 0, position: Position.Right };
		const target = { x: 100, y: 80, position: Position.Left };
		const path = [
			[20, 0],
			[20, 80],
			[80, 80],
		];
		expect(svgDrawStraightLinePath(source, target, path)).toBe(reactStraight(source, target, path));
		expect(svgDrawSmoothLinePath(source, target, path)).toBe(reactSmooth(source, target, path));
		expect(svgDrawSmoothStepLinePath({ borderRadius: 12 })(source, target, path)).toBe(
			reactSmoothStep({ borderRadius: 12 })(source, target, path),
		);
		expect(svgDrawSimpleBezierLinePath(source, target, path)).toBe(
			reactSimpleBezier(source, target, path),
		);
	});

	it('routes waypoints through the same upstream path and center', () => {
		const params = {
			...routeParams,
			waypoints: [{ x: 190, y: 190 }],
		};
		const actual = getSmartEdgeWaypoints(params);
		expect(actual).toEqual(getReactSmartEdgeWaypoints(params as never));
		expect(actual).not.toBeInstanceOf(Error);
		expect((actual as Exclude<typeof actual, Error>).points).toContainEqual([190, 190]);
	});

	it('returns a real error when a path generator fails', () => {
		const result = getSmartEdge({
			...routeParams,
			options: {
				...routeParams.options,
				generatePath() {
					throw new Error('unroutable');
				},
			},
		});
		expect(result).toEqual(new Error('unroutable'));
	});

	it('matches upstream floating-edge geometry', () => {
		const source = nodes[0];
		const target = nodes[2];
		const intersection = getNodeIntersection(source, target);
		expect(intersection).toEqual(getReactNodeIntersection(source as never, target as never));
		expect(getEdgePosition(source, intersection)).toBe(
			getReactEdgePosition(source as never, intersection),
		);
		expect(getFloatingEdgeParams(source, target)).toEqual(
			getReactFloatingEdgeParams(source as never, target as never),
		);
	});

	it('resolves subflow positions and excludes the edge container obstacle', () => {
		const subflowNodes: NodeBase[] = [
			{
				id: 'group',
				data: {},
				position: { x: 250, y: 200 },
				origin: [0.5, 0],
				measured: { width: 300, height: 160 },
			},
			{
				id: 'child-source',
				parentId: 'group',
				data: {},
				position: { x: 30, y: 40 },
				origin: [0.5, 0.5],
				measured: { width: 40, height: 40 },
			},
			{
				id: 'child-target',
				parentId: 'group',
				data: {},
				position: { x: 230, y: 40 },
				origin: [0.5, 0.5],
				measured: { width: 40, height: 40 },
			},
			{
				id: 'sibling-obstacle',
				data: {},
				position: { x: 220, y: 260 },
				measured: { width: 40, height: 40 },
			},
		];
		const absolute = getAbsoluteNodes(subflowNodes);
		expect(absolute.find((node) => node.id === 'child-source')?.position).toEqual({
			x: 130,
			y: 240,
		});
		expect(
			getNodePositionWithOrigin(absolute.find((node) => node.id === 'child-source') as NodeBase),
		).toEqual({
			x: 110,
			y: 220,
		});
		expect(
			excludeEdgeAncestorNodes(absolute, 'child-source', 'child-target').map((node) => node.id),
		).toEqual(['child-source', 'child-target', 'sibling-obstacle']);
	});
});
