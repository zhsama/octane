import type { Position, XYPosition } from '@xyflow/system';
import { round, roundUp } from './bounds.js';
import { createPathfindingGrid } from './pathfinding.js';
import type { GraphBoundingBox, Grid, GridNode, NodeBoundingBox, PointInfo } from './types.js';

export const graphToGridPoint = (
	point: XYPosition,
	smallestX: number,
	smallestY: number,
	gridRatio: number,
): XYPosition => ({
	x: (point.x - smallestX) / gridRatio + 1,
	y: (point.y - smallestY) / gridRatio + 1,
});

export const gridToGraphPoint = (
	point: XYPosition,
	smallestX: number,
	smallestY: number,
	gridRatio: number,
): XYPosition => ({
	x: (point.x - 1) * gridRatio + smallestX,
	y: (point.y - 1) * gridRatio + smallestY,
});

const gridDimensions = (graph: GraphBoundingBox, gridRatio: number) => ({
	mapColumns: roundUp(graph.width, gridRatio) / gridRatio + 1,
	mapRows: roundUp(graph.height, gridRatio) / gridRatio + 1,
});

const forEachNodeCell = (
	nodes: NodeBoundingBox[],
	xMin: number,
	yMin: number,
	gridRatio: number,
	visit: (column: number, row: number) => void,
): void => {
	for (const node of nodes) {
		const start = graphToGridPoint(node.topLeft, xMin, yMin, gridRatio);
		const end = graphToGridPoint(node.bottomRight, xMin, yMin, gridRatio);
		for (let column = start.x; column < end.x; column++) {
			for (let row = start.y; row < end.y; row++) visit(column, row);
		}
	}
};

export const buildObstacleMatrix = (
	graph: GraphBoundingBox,
	nodes: NodeBoundingBox[],
	gridRatio: number,
): number[][] => {
	const { mapColumns, mapRows } = gridDimensions(graph, gridRatio);
	const matrix = Array.from({ length: mapRows }, () =>
		Array.from<number>({ length: mapColumns }).fill(0),
	);
	forEachNodeCell(nodes, graph.xMin, graph.yMin, gridRatio, (column, row) => {
		if (column >= 0 && column < mapColumns && row >= 0 && row < mapRows) {
			matrix[row][column] = 1;
		}
	});
	return matrix;
};

type Direction = 'top' | 'bottom' | 'left' | 'right';

const nextPoint = (point: XYPosition, position: Direction): XYPosition => {
	switch (position) {
		case 'top':
			return { x: point.x, y: point.y - 1 };
		case 'bottom':
			return { x: point.x, y: point.y + 1 };
		case 'left':
			return { x: point.x - 1, y: point.y };
		case 'right':
			return { x: point.x + 1, y: point.y };
	}
};

const guaranteeWalkablePath = (grid: Grid, point: XYPosition, position: Position): void => {
	let node: GridNode = grid.getNodeAt(point.x, point.y);
	while (!node.walkable) {
		grid.setWalkableAt(node.x, node.y, true);
		const next = nextPoint(node, position);
		node = grid.getNodeAt(next.x, next.y);
	}
};

export const createRoutingGrid = (
	graph: GraphBoundingBox,
	nodes: NodeBoundingBox[],
	source: PointInfo,
	target: PointInfo,
	gridRatio = 2,
	obstacleMatrix?: number[][],
) => {
	const { mapColumns, mapRows } = gridDimensions(graph, gridRatio);
	const matrix = obstacleMatrix ?? buildObstacleMatrix(graph, nodes, gridRatio);
	// createPathfindingGrid materializes fresh GridNode objects. Search metadata
	// therefore never mutates the matrix cached and reused by sibling edges.
	const grid = createPathfindingGrid(mapColumns, mapRows, matrix);
	const startGrid = graphToGridPoint(
		{ x: round(source.x, gridRatio), y: round(source.y, gridRatio) },
		graph.xMin,
		graph.yMin,
		gridRatio,
	);
	const endGrid = graphToGridPoint(
		{ x: round(target.x, gridRatio), y: round(target.y, gridRatio) },
		graph.xMin,
		graph.yMin,
		gridRatio,
	);
	const startingNode = grid.getNodeAt(startGrid.x, startGrid.y);
	const endingNode = grid.getNodeAt(endGrid.x, endGrid.y);
	guaranteeWalkablePath(grid, startingNode, source.position);
	guaranteeWalkablePath(grid, endingNode, target.position);
	return {
		grid,
		start: nextPoint(startingNode, source.position),
		end: nextPoint(endingNode, target.position),
	};
};
