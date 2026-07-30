// Pathfinding algorithms are adapted from PathFinding.js and
// @tisoap/react-flow-smart-edge@4.13.0 (MIT).

import type { DiagonalMovement, Grid, GridNode } from './types.js';

const withinBounds = (width: number, height: number, x: number, y: number): boolean =>
	x >= 0 && x < width && y >= 0 && y < height;

const createNodes = (
	width: number,
	height: number,
	matrix?: (number | boolean)[][],
): GridNode[][] =>
	Array.from({ length: height }, (_unused, row) =>
		Array.from({ length: width }, (_unusedColumn, column) => ({
			x: column,
			y: row,
			walkable: matrix ? !matrix[row]?.[column] : true,
		})),
	);

export const createPathfindingGrid = (
	width: number,
	height: number,
	matrix?: (number | boolean)[][],
): Grid => {
	const nodes = createNodes(width, height, matrix);

	const getNodeAt = (column: number, row: number): GridNode => nodes[row][column];
	const isWalkableAt = (column: number, row: number): boolean =>
		withinBounds(width, height, column, row) && nodes[row][column].walkable;
	const setWalkableAt = (column: number, row: number, walkable: boolean): void => {
		if (withinBounds(width, height, column, row)) {
			nodes[row][column].walkable = walkable;
		}
	};
	const getNeighbors = (node: GridNode, movement: DiagonalMovement): GridNode[] => {
		const { x: column, y: row } = node;
		const neighbors: GridNode[] = [];

		const north = isWalkableAt(column, row - 1);
		const east = isWalkableAt(column + 1, row);
		const south = isWalkableAt(column, row + 1);
		const west = isWalkableAt(column - 1, row);

		if (north) neighbors.push(getNodeAt(column, row - 1));
		if (east) neighbors.push(getNodeAt(column + 1, row));
		if (south) neighbors.push(getNodeAt(column, row + 1));
		if (west) neighbors.push(getNodeAt(column - 1, row));

		if (movement === 'Always') {
			if (isWalkableAt(column + 1, row - 1)) neighbors.push(getNodeAt(column + 1, row - 1));
			if (isWalkableAt(column + 1, row + 1)) neighbors.push(getNodeAt(column + 1, row + 1));
			if (isWalkableAt(column - 1, row + 1)) neighbors.push(getNodeAt(column - 1, row + 1));
			if (isWalkableAt(column - 1, row - 1)) neighbors.push(getNodeAt(column - 1, row - 1));
		}

		return neighbors;
	};

	return {
		width,
		height,
		nodes,
		getNodeAt,
		isWalkableAt,
		setWalkableAt,
		getNeighbors,
		isInside: (column, row) => withinBounds(width, height, column, row),
		clone: () =>
			createPathfindingGrid(
				width,
				height,
				nodes.map((row) => row.map((node) => (node.walkable ? 0 : 1))),
			),
	};
};

const estimatedTotalCostOf = (node: GridNode): number => node.estimatedTotalCost ?? Infinity;
const costFromStartOrZero = (node: GridNode): number => node.costFromStart ?? 0;
const costFromStartOrInfinity = (node: GridNode): number => node.costFromStart ?? Infinity;

const selectLowestCost = (openList: GridNode[]): GridNode => {
	let bestIndex = 0;
	for (let index = 1; index < openList.length; index++) {
		if (estimatedTotalCostOf(openList[index]) < estimatedTotalCostOf(openList[bestIndex])) {
			bestIndex = index;
		}
	}
	return openList.splice(bestIndex, 1)[0];
};

const reconstructPath = (endNode: GridNode): number[][] => {
	const path: number[][] = [];
	let node: GridNode | undefined = endNode;
	while (node) {
		path.push([node.x, node.y]);
		node = node.parent;
	}
	return path.reverse();
};

const manhattan = (deltaX: number, deltaY: number): number => deltaX + deltaY;
const octile = (deltaX: number, deltaY: number): number => {
	const diagonalFactor = Math.SQRT2 - 1;
	return deltaX < deltaY ? diagonalFactor * deltaX + deltaY : diagonalFactor * deltaY + deltaX;
};

export interface AStarOptions {
	diagonalMovement?: DiagonalMovement;
	heuristic?: (deltaX: number, deltaY: number) => number;
	weight?: number;
}

export const createAStarFinder = (options: AStarOptions = {}) => {
	const diagonalMovement = options.diagonalMovement ?? 'Never';
	const heuristic = options.heuristic ?? (diagonalMovement === 'Never' ? manhattan : octile);
	const weight = options.weight ?? 1;

	const findPath = (
		startX: number,
		startY: number,
		endX: number,
		endY: number,
		grid: Grid,
	): number[][] => {
		const start = grid.getNodeAt(startX, startY);
		const end = grid.getNodeAt(endX, endY);
		const openList: GridNode[] = [];

		start.costFromStart = 0;
		start.heuristicCostToGoal = 0;
		start.estimatedTotalCost = 0;
		start.opened = true;
		openList.push(start);

		while (openList.length > 0) {
			const node = selectLowestCost(openList);
			node.closed = true;

			if (node === end) return reconstructPath(end);

			for (const neighbor of grid.getNeighbors(node, diagonalMovement)) {
				if (neighbor.closed) continue;

				const deltaX = Math.abs(neighbor.x - node.x);
				const deltaY = Math.abs(neighbor.y - node.y);
				const tentativeCost =
					costFromStartOrZero(node) + (deltaX === 0 || deltaY === 0 ? 1 : Math.SQRT2);

				if (!neighbor.opened || tentativeCost < costFromStartOrInfinity(neighbor)) {
					neighbor.costFromStart = tentativeCost;
					neighbor.heuristicCostToGoal ??=
						weight * heuristic(Math.abs(neighbor.x - end.x), Math.abs(neighbor.y - end.y));
					neighbor.estimatedTotalCost = tentativeCost + neighbor.heuristicCostToGoal;
					neighbor.parent = node;
					if (!neighbor.opened) {
						neighbor.opened = true;
						openList.push(neighbor);
					}
				}
			}
		}

		return [];
	};

	return { findPath };
};

const findStartNeighbors = (node: GridNode, grid: Grid): number[][] =>
	grid.getNeighbors(node, 'Never').map((neighbor) => [neighbor.x, neighbor.y]);

const findHorizontalNeighbors = (
	grid: Grid,
	column: number,
	row: number,
	deltaX: number,
): number[][] => {
	const neighbors: number[][] = [];
	if (grid.isWalkableAt(column, row - 1)) neighbors.push([column, row - 1]);
	if (grid.isWalkableAt(column, row + 1)) neighbors.push([column, row + 1]);
	if (grid.isWalkableAt(column + deltaX, row)) neighbors.push([column + deltaX, row]);
	return neighbors;
};

const findVerticalNeighbors = (
	grid: Grid,
	column: number,
	row: number,
	deltaY: number,
): number[][] => {
	const neighbors: number[][] = [];
	if (grid.isWalkableAt(column - 1, row)) neighbors.push([column - 1, row]);
	if (grid.isWalkableAt(column + 1, row)) neighbors.push([column + 1, row]);
	if (grid.isWalkableAt(column, row + deltaY)) neighbors.push([column, row + deltaY]);
	return neighbors;
};

const findJumpNeighbors = (node: GridNode, grid: Grid): number[][] => {
	if (!node.parent) return findStartNeighbors(node, grid);

	const deltaX = (node.x - node.parent.x) / Math.max(Math.abs(node.x - node.parent.x), 1);
	const deltaY = (node.y - node.parent.y) / Math.max(Math.abs(node.y - node.parent.y), 1);

	if (deltaX !== 0) return findHorizontalNeighbors(grid, node.x, node.y, deltaX);
	if (deltaY !== 0) return findVerticalNeighbors(grid, node.x, node.y, deltaY);
	return [];
};

const hasForcedHorizontalNeighbor = (
	grid: Grid,
	column: number,
	row: number,
	deltaX: number,
): boolean =>
	(grid.isWalkableAt(column, row - 1) && !grid.isWalkableAt(column - deltaX, row - 1)) ||
	(grid.isWalkableAt(column, row + 1) && !grid.isWalkableAt(column - deltaX, row + 1));

const hasForcedVerticalNeighbor = (
	grid: Grid,
	column: number,
	row: number,
	deltaY: number,
): boolean =>
	(grid.isWalkableAt(column - 1, row) && !grid.isWalkableAt(column - 1, row - deltaY)) ||
	(grid.isWalkableAt(column + 1, row) && !grid.isWalkableAt(column + 1, row - deltaY));

const createJump = (grid: Grid, end: GridNode) => {
	const jump = (
		column: number,
		row: number,
		parentColumn: number,
		parentRow: number,
	): number[] | null => {
		if (!grid.isWalkableAt(column, row)) return null;
		if (grid.getNodeAt(column, row) === end) return [column, row];

		const deltaX = column - parentColumn;
		const deltaY = row - parentRow;

		if (deltaX !== 0 && hasForcedHorizontalNeighbor(grid, column, row, deltaX)) {
			return [column, row];
		}
		if (deltaY !== 0) {
			if (hasForcedVerticalNeighbor(grid, column, row, deltaY)) return [column, row];
			if (jump(column + 1, row, column, row) ?? jump(column - 1, row, column, row)) {
				return [column, row];
			}
		}

		return jump(column + deltaX, row + deltaY, column, row);
	};
	return jump;
};

export const createJumpPointFinder = () => {
	const findPath = (
		startX: number,
		startY: number,
		endX: number,
		endY: number,
		grid: Grid,
	): number[][] => {
		const start = grid.getNodeAt(startX, startY);
		const end = grid.getNodeAt(endX, endY);
		const openList: GridNode[] = [];
		const jump = createJump(grid, end);

		start.costFromStart = 0;
		start.heuristicCostToGoal = 0;
		start.estimatedTotalCost = 0;
		start.opened = true;
		openList.push(start);

		while (openList.length > 0) {
			const node = selectLowestCost(openList);
			node.closed = true;
			if (node === end) return reconstructPath(end);

			for (const [neighborX, neighborY] of findJumpNeighbors(node, grid)) {
				const jumpPoint = jump(neighborX, neighborY, node.x, node.y);
				if (!jumpPoint) continue;

				const [jumpX, jumpY] = jumpPoint;
				const jumpNode = grid.getNodeAt(jumpX, jumpY);
				if (jumpNode.closed) continue;

				const tentativeCost =
					costFromStartOrZero(node) + manhattan(Math.abs(jumpX - node.x), Math.abs(jumpY - node.y));
				if (!jumpNode.opened || tentativeCost < costFromStartOrInfinity(jumpNode)) {
					jumpNode.costFromStart = tentativeCost;
					jumpNode.heuristicCostToGoal ??= manhattan(
						Math.abs(jumpX - endX),
						Math.abs(jumpY - endY),
					);
					jumpNode.estimatedTotalCost = tentativeCost + jumpNode.heuristicCostToGoal;
					jumpNode.parent = node;
					if (!jumpNode.opened) {
						jumpNode.opened = true;
						openList.push(jumpNode);
					}
				}
			}
		}

		return [];
	};

	return { findPath };
};

const noPath = (path: number[][]): number[][] => {
	if (path.length === 0) throw new Error('No path found');
	return path;
};

export const pathfindingAStarDiagonal = (
	grid: Grid,
	start: { x: number; y: number },
	end: { x: number; y: number },
): number[][] =>
	noPath(
		createAStarFinder({ diagonalMovement: 'Always' }).findPath(
			start.x,
			start.y,
			end.x,
			end.y,
			grid,
		),
	);

export const pathfindingAStarNoDiagonal = (
	grid: Grid,
	start: { x: number; y: number },
	end: { x: number; y: number },
): number[][] =>
	noPath(
		createAStarFinder({ diagonalMovement: 'Never' }).findPath(start.x, start.y, end.x, end.y, grid),
	);

export const pathfindingJumpPointNoDiagonal = (
	grid: Grid,
	start: { x: number; y: number },
	end: { x: number; y: number },
): number[][] => noPath(createJumpPointFinder().findPath(start.x, start.y, end.x, end.y, grid));
