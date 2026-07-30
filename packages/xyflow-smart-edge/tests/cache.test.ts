import { Position } from '@xyflow/system';
import { getSmartEdge, type NodeBase } from '@octanejs/xyflow-smart-edge';
import {
	resetSharedGridCacheForTests,
	sharedGridCacheStatsForTests,
} from '../src/shared-grid-cache.js';
import { beforeEach, describe, expect, it } from 'vitest';

const makeNodes = (offset = 0): NodeBase[] => [
	{
		id: `source-${String(offset)}`,
		data: {},
		position: { x: offset, y: 0 },
		measured: { width: 40, height: 40 },
	},
	{
		id: `target-${String(offset)}`,
		data: {},
		position: { x: offset + 160, y: 0 },
		measured: { width: 40, height: 40 },
	},
];

const route = (nodes: NodeBase[]) =>
	getSmartEdge({
		nodes,
		sourceX: nodes[0].position.x + 40,
		sourceY: 20,
		targetX: nodes[1].position.x,
		targetY: 20,
		sourcePosition: Position.Right,
		targetPosition: Position.Left,
		options: { gridRatio: 10, nodePadding: 10 },
	});

beforeEach(resetSharedGridCacheForTests);

describe('shared grid cache', () => {
	it('reuses immutable obstacle data but isolates mutable sibling searches', () => {
		const nodes = makeNodes();
		const first = route(nodes);
		const second = route(nodes);
		expect(first).toEqual(second);
		expect(first).not.toBeInstanceOf(Error);
		expect(sharedGridCacheStatsForTests()).toMatchObject({
			buildCount: 1,
			size: 1,
			maxEntries: 8,
		});
	});

	it('keys positions and dimensions and stays bounded', () => {
		for (let index = 0; index < 20; index++) {
			expect(route(makeNodes(index * 20))).not.toBeInstanceOf(Error);
			expect(sharedGridCacheStatsForTests().size).toBeLessThanOrEqual(8);
		}
		expect(sharedGridCacheStatsForTests().buildCount).toBe(20);
	});

	it('cannot collide when ids contain the old comma-and-pipe delimiters', () => {
		const endpointNodes: NodeBase[] = [
			{
				id: 'source',
				data: {},
				position: { x: 0, y: 80 },
				measured: { width: 80, height: 40 },
			},
			{
				id: 'target',
				data: {},
				position: { x: 300, y: 80 },
				measured: { width: 80, height: 40 },
			},
		];
		const unblockedNodes: NodeBase[] = [
			{
				// Under the old delimiter key this one record encoded the same
				// text as the first two records in blockedNodes.
				id: 'a,130,45,80,110|b',
				data: {},
				position: { x: 1000, y: 1000 },
				measured: { width: 1, height: 1 },
			},
			...endpointNodes,
		];
		const blockedNodes: NodeBase[] = [
			{
				id: 'a',
				data: {},
				position: { x: 130, y: 45 },
				measured: { width: 80, height: 110 },
			},
			{
				id: 'b',
				data: {},
				position: { x: 1000, y: 1000 },
				measured: { width: 1, height: 1 },
			},
			...endpointNodes,
		];
		const routeThrough = (nodes: NodeBase[]) =>
			getSmartEdge({
				nodes,
				sourceX: 80,
				sourceY: 100,
				targetX: 300,
				targetY: 100,
				sourcePosition: Position.Right,
				targetPosition: Position.Left,
				options: { gridRatio: 10, nodePadding: 20 },
			});

		const unblocked = routeThrough(unblockedNodes);
		const blocked = routeThrough(blockedNodes);
		expect(unblocked).not.toBeInstanceOf(Error);
		expect(blocked).not.toBeInstanceOf(Error);
		expect(blocked).not.toEqual(unblocked);
		expect(sharedGridCacheStatsForTests().buildCount).toBe(2);

		resetSharedGridCacheForTests();
		expect(routeThrough(blockedNodes)).toEqual(blocked);
	});
});
