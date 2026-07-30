import { Position } from '@xyflow/system';
import type { NodeBase, XYPosition } from '@xyflow/system';
import { getBoundingBoxes, round, toInteger } from './bounds.js';
import { alignEndpoints, svgDrawSmoothLinePath } from './draw.js';
import { createRoutingGrid, gridToGraphPoint } from './grid.js';
import { pathfindingAStarDiagonal } from './pathfinding.js';
import { getSharedGrid, isWithinSharedBounds } from './shared-grid-cache.js';
import type {
	GetSmartEdgeParams,
	GetSmartEdgeReturn,
	GetSmartEdgeWaypointsParams,
	NodeBase as PublicNodeBase,
	PointInfo,
} from './types.js';

export const getSmartEdge = <
	NodeDataType extends Record<string, unknown> = Record<string, unknown>,
	NodeType extends PublicNodeBase<NodeDataType> = PublicNodeBase<NodeDataType>,
>({
	options = {},
	nodes,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
}: GetSmartEdgeParams<NodeDataType, NodeType>): GetSmartEdgeReturn | Error => {
	try {
		const {
			drawEdge = svgDrawSmoothLinePath,
			generatePath = pathfindingAStarDiagonal,
			avoidAreas = [],
		} = options;
		const gridRatio = toInteger(options.gridRatio ?? 10);
		const nodePadding = toInteger(options.nodePadding ?? 10);
		const source: PointInfo = { x: sourceX, y: sourceY, position: sourcePosition };
		const target: PointInfo = { x: targetX, y: targetY, position: targetPosition };
		const shared = getSharedGrid(nodes as NodeBase[], nodePadding, gridRatio, avoidAreas);

		let graphBox;
		let routingGrid;
		if (
			shared &&
			isWithinSharedBounds(shared, [
				{ x: sourceX, y: sourceY },
				{ x: targetX, y: targetY },
			])
		) {
			graphBox = shared.graphBox;
			routingGrid = createRoutingGrid(
				graphBox,
				shared.obstacleBoxes,
				source,
				target,
				gridRatio,
				shared.obstacleMatrix,
			);
		} else {
			const bounds = getBoundingBoxes(nodes, nodePadding, gridRatio, avoidAreas, [
				{ x: sourceX, y: sourceY },
				{ x: targetX, y: targetY },
			]);
			graphBox = bounds.graphBox;
			routingGrid = createRoutingGrid(
				graphBox,
				[...bounds.nodeBoxes, ...bounds.avoidBoxes],
				source,
				target,
				gridRatio,
			);
		}

		const fullPath = generatePath(routingGrid.grid, routingGrid.start, routingGrid.end);
		const graphPath = fullPath.map(([x, y]) => {
			const point = gridToGraphPoint({ x, y }, graphBox.xMin, graphBox.yMin, gridRatio);
			return [point.x, point.y];
		});
		const alignedPath = alignEndpoints(source, target, graphPath);
		const svgPathString = drawEdge(source, target, alignedPath);
		const [middleX, middleY] = fullPath[Math.floor(fullPath.length / 2)];
		const center = gridToGraphPoint(
			{ x: middleX, y: middleY },
			graphBox.xMin,
			graphBox.yMin,
			gridRatio,
		);
		return {
			svgPathString,
			edgeCenterX: center.x,
			edgeCenterY: center.y,
			points: alignedPath,
		};
	} catch (error) {
		return error instanceof Error ? error : new Error(`Unknown error: ${String(error)}`);
	}
};

const sideFacing = (point: XYPosition, toward: XYPosition): Position => {
	const deltaX = toward.x - point.x;
	const deltaY = toward.y - point.y;
	if (Math.abs(deltaX) >= Math.abs(deltaY)) {
		return deltaX >= 0 ? Position.Right : Position.Left;
	}
	return deltaY >= 0 ? Position.Bottom : Position.Top;
};

interface StitchPoint extends XYPosition {
	waypoint: boolean;
}

const routeSegments = <
	NodeDataType extends Record<string, unknown>,
	NodeType extends PublicNodeBase<NodeDataType>,
>(
	chain: XYPosition[],
	sourcePosition: Position,
	targetPosition: Position,
	nodes: NodeType[],
	options: NonNullable<GetSmartEdgeParams<NodeDataType, NodeType>['options']>,
): StitchPoint[] => {
	const result: StitchPoint[] = [];
	const lastIndex = chain.length - 1;
	for (let index = 0; index < lastIndex; index++) {
		const from = chain[index];
		const to = chain[index + 1];
		const segment = getSmartEdge<NodeDataType, NodeType>({
			sourceX: from.x,
			sourceY: from.y,
			sourcePosition: index === 0 ? sourcePosition : sideFacing(from, to),
			targetX: to.x,
			targetY: to.y,
			targetPosition: index + 1 === lastIndex ? targetPosition : sideFacing(to, from),
			nodes,
			options,
		});
		if (!(segment instanceof Error)) {
			for (const [x, y] of segment.points) result.push({ x, y, waypoint: false });
		}
		if (index + 1 < lastIndex) result.push({ ...to, waypoint: true });
	}
	return result;
};

const dedupeStitchPoints = (points: StitchPoint[]): StitchPoint[] => {
	const result: StitchPoint[] = [];
	for (const point of points) {
		const previous = result.at(-1);
		if (previous && previous.x === point.x && previous.y === point.y) {
			previous.waypoint ||= point.waypoint;
		} else {
			result.push({ ...point });
		}
	}
	return result;
};

const straddleWaypoint = (
	waypoint: XYPosition,
	before: XYPosition,
	after: XYPosition,
): number[][] => {
	const directionX = after.x - before.x;
	const directionY = after.y - before.y;
	const directionLength = Math.hypot(directionX, directionY);
	if (directionLength === 0) return [[waypoint.x, waypoint.y]];
	const distanceBefore = Math.hypot(waypoint.x - before.x, waypoint.y - before.y);
	const distanceAfter = Math.hypot(waypoint.x - after.x, waypoint.y - after.y);
	const length = Math.min(distanceBefore, distanceAfter) * 0.5;
	const unitX = directionX / directionLength;
	const unitY = directionY / directionLength;
	return [
		[waypoint.x - unitX * length, waypoint.y - unitY * length],
		[waypoint.x + unitX * length, waypoint.y + unitY * length],
	];
};

const drawPoints = (points: StitchPoint[], source: XYPosition, target: XYPosition): number[][] => {
	const result: number[][] = [];
	for (let index = 0; index < points.length; index++) {
		const point = points[index];
		if (!point.waypoint) {
			result.push([point.x, point.y]);
			continue;
		}
		result.push(
			...straddleWaypoint(
				point,
				index > 0 ? points[index - 1] : source,
				index < points.length - 1 ? points[index + 1] : target,
			),
		);
	}
	return result;
};

export const getSmartEdgeWaypoints = <
	NodeDataType extends Record<string, unknown> = Record<string, unknown>,
	NodeType extends PublicNodeBase<NodeDataType> = PublicNodeBase<NodeDataType>,
>(
	params: GetSmartEdgeWaypointsParams<NodeDataType, NodeType>,
): GetSmartEdgeReturn | Error => {
	if (params.waypoints.length === 0) return getSmartEdge(params);
	try {
		const {
			waypoints,
			options = {},
			nodes,
			sourceX,
			sourceY,
			targetX,
			targetY,
			sourcePosition,
			targetPosition,
		} = params;
		const gridRatio = Math.max(toInteger(options.gridRatio ?? 10), 1);
		const source = { x: sourceX, y: sourceY };
		const target = { x: targetX, y: targetY };
		const snappedWaypoints = waypoints.map((point) => ({
			x: round(point.x, gridRatio),
			y: round(point.y, gridRatio),
		}));
		const stitched = dedupeStitchPoints(
			routeSegments(
				[source, ...snappedWaypoints, target],
				sourcePosition,
				targetPosition,
				nodes,
				options,
			),
		);
		const points = stitched.map((point) => [point.x, point.y]);
		const svgPathString = (options.drawEdge ?? svgDrawSmoothLinePath)(
			{ ...source, position: sourcePosition },
			{ ...target, position: targetPosition },
			drawPoints(stitched, source, target),
		);
		const fullPath = [[source.x, source.y], ...points, [target.x, target.y]];
		const [edgeCenterX, edgeCenterY] = fullPath[Math.floor(fullPath.length / 2)];
		return { svgPathString, edgeCenterX, edgeCenterY, points };
	} catch (error) {
		return error instanceof Error ? error : new Error(`Unknown error: ${String(error)}`);
	}
};
