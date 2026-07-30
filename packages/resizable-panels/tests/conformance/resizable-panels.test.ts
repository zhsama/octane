import { flushSync } from 'octane';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mount, type MountResult } from '../../../octane/tests/_helpers';
import type { GroupImperativeHandle, PanelImperativeHandle } from '../../src/index';
import { notifyResize, observedElementIds, setTestPanelWidth } from '../_setup';
import {
	CallbackRefFixture,
	DefaultLayoutFixture,
	HookSlotIsolationFixture,
	NumericPanelIdFixture,
	PanelsFixture,
	TwoGroupsFixture,
} from './fixtures.tsrx';

let mounted: MountResult[] = [];

beforeEach(() => {
	setTestPanelWidth(296);
});

afterEach(() => {
	for (const result of mounted.splice(0)) {
		result.unmount();
	}
});

function trackedMount(...args: Parameters<typeof mount>) {
	const result = mount(...args);
	mounted.push(result);
	return result;
}

describe('@octanejs/resizable-panels conformance', () => {
	it('exposes refs, passthrough attributes, layout callbacks, and imperative APIs', () => {
		const groupRef = { current: null as GroupImperativeHandle | null };
		const panelRef = { current: null as PanelImperativeHandle | null };
		const groupElementRef = { current: null as HTMLDivElement | null };
		const panelElementRef = { current: null as HTMLDivElement | null };
		const separatorElementRef = { current: null as HTMLDivElement | null };
		const onLayoutChanged = vi.fn();

		const result = trackedMount(PanelsFixture, {
			groupRef,
			panelRef,
			groupElementRef,
			panelElementRef,
			separatorElementRef,
			onLayoutChanged,
		});

		expect(groupElementRef.current).toBe(result.find('#test-group'));
		expect(panelElementRef.current).toBe(result.find('#left'));
		expect(separatorElementRef.current).toBe(result.find('#separator'));
		expect(result.find('#test-group').getAttribute('data-extra')).toBe('group-extra');
		expect(result.find('#left').getAttribute('data-extra')).toBe('panel-extra');
		expect(result.find('#separator').getAttribute('data-extra')).toBe('separator-extra');
		expect(groupRef.current?.getLayout()).toEqual({ left: 50, right: 50 });
		expect(panelRef.current?.getSize().asPercentage).toBe(50);
		expect(onLayoutChanged).toHaveBeenLastCalledWith(
			{ left: 50, right: 50 },
			{ isUserInteraction: false },
		);

		flushSync(() => {
			groupRef.current?.setLayout({ left: 30, right: 70 });
		});
		expect(groupRef.current?.getLayout()).toEqual({ left: 30, right: 70 });
		expect(onLayoutChanged).toHaveBeenLastCalledWith(
			{ left: 30, right: 70 },
			{ isUserInteraction: false },
		);

		flushSync(() => panelRef.current?.resize('40%'));
		expect(panelRef.current?.getSize().asPercentage).toBe(40);
		flushSync(() => panelRef.current?.collapse());
		expect(panelRef.current?.isCollapsed()).toBe(true);
		flushSync(() => panelRef.current?.expand());
		expect(panelRef.current?.getSize().asPercentage).toBe(40);
	});

	it('observes panels only when onResize is callable and responds to prop addition', () => {
		const result = trackedMount(PanelsFixture, {});
		expect(observedElementIds()).toEqual(['test-group']);

		const onResize = vi.fn();
		result.update(PanelsFixture, { onResize });
		expect(observedElementIds()).toEqual(['left', 'test-group']);
		expect(onResize).toHaveBeenCalledWith(
			expect.objectContaining({ asPercentage: 50 }),
			'left',
			undefined,
		);
	});

	it('keeps independent mounted group state', () => {
		const firstRef = { current: null as GroupImperativeHandle | null };
		const secondRef = { current: null as GroupImperativeHandle | null };
		trackedMount(TwoGroupsFixture, { firstRef, secondRef });

		flushSync(() => firstRef.current?.setLayout({ first: 20, second: 80 }));
		expect(firstRef.current?.getLayout()).toEqual({ first: 20, second: 80 });
		expect(secondRef.current?.getLayout()).toEqual({ alpha: 50, omega: 50 });
	});

	it('returns React-compatible two-member callback-ref tuples', () => {
		const observations: unknown[][] = [];
		trackedMount(CallbackRefFixture, {
			observe: (...values: unknown[]) => observations.push(values),
		});

		const [groupTuple, panelTuple] = observations.at(-1) as [
			readonly unknown[],
			readonly unknown[],
		];
		expect(groupTuple).toHaveLength(2);
		expect(panelTuple).toHaveLength(2);
		expect(groupTuple[0]).toMatchObject({
			getLayout: expect.any(Function),
			setLayout: expect.any(Function),
		});
		expect(panelTuple[0]).toMatchObject({
			collapse: expect.any(Function),
			expand: expect.any(Function),
			resize: expect.any(Function),
		});
	});

	it('keeps repeated typed ref-hook call sites isolated within one component', () => {
		let refs:
			| {
					firstGroupRef: { current: GroupImperativeHandle | null };
					secondGroupRef: { current: GroupImperativeHandle | null };
					firstPanelRef: { current: PanelImperativeHandle | null };
					secondPanelRef: { current: PanelImperativeHandle | null };
			  }
			| undefined;
		trackedMount(HookSlotIsolationFixture, {
			observe: (value: typeof refs) => {
				refs = value;
			},
		});

		expect(refs?.firstGroupRef).not.toBe(refs?.secondGroupRef);
		expect(refs?.firstPanelRef).not.toBe(refs?.secondPanelRef);
		expect(refs?.firstGroupRef.current?.getLayout()).toEqual({
			'slot-panel-one': 40,
			'slot-panel-one-tail': 60,
		});
		expect(refs?.secondGroupRef.current?.getLayout()).toEqual({
			'slot-panel-two': 70,
			'slot-panel-two-tail': 30,
		});
		expect(refs?.firstPanelRef.current?.getSize().asPercentage).toBe(40);
		expect(refs?.secondPanelRef.current?.getSize().asPercentage).toBe(70);
	});

	it('treats numeric zero as a stable panel id and default-layout key', () => {
		const groupRef = { current: null as GroupImperativeHandle | null };
		const onResize = vi.fn();
		const result = trackedMount(NumericPanelIdFixture, { groupRef, onResize });

		expect(result.find('[data-panel][id="0"]').id).toBe('0');
		expect(groupRef.current?.getLayout()).toEqual({
			0: 35,
			'numeric-panel-tail': 65,
		});
		expect(onResize.mock.calls[0]?.[1]).toBe(0);
	});

	it('restores and conditionally persists layouts through useDefaultLayout', () => {
		const values = new Map([
			[
				'react-resizable-panels:stored-layout:stored-left:stored-right',
				JSON.stringify({ 'stored-left': 35, 'stored-right': 65 }),
			],
		]);
		const storage = {
			getItem: vi.fn((key: string) => values.get(key) ?? null),
			setItem: vi.fn((key: string, value: string) => values.set(key, value)),
		};
		let api:
			| {
					defaultLayout: Record<string, number> | undefined;
					onLayoutChanged: (
						layout: Record<string, number>,
						meta: { isUserInteraction: boolean },
					) => void;
			  }
			| undefined;

		trackedMount(DefaultLayoutFixture, {
			id: 'stored-layout',
			panelIds: ['stored-left', 'stored-right'],
			storage,
			onlySaveAfterUserInteractions: true,
			observe: (value: typeof api) => {
				api = value;
			},
		});

		expect(api?.defaultLayout).toEqual({
			'stored-left': 35,
			'stored-right': 65,
		});
		api?.onLayoutChanged({ 'stored-left': 40, 'stored-right': 60 }, { isUserInteraction: false });
		expect(storage.setItem).not.toHaveBeenCalled();
		api?.onLayoutChanged({ 'stored-left': 45, 'stored-right': 55 }, { isUserInteraction: true });
		expect(storage.setItem).toHaveBeenCalledOnce();
	});

	it('renders the separator ARIA contract', () => {
		const groupRef = { current: null as GroupImperativeHandle | null };
		const result = trackedMount(PanelsFixture, { groupRef });
		flushSync(() => {});
		setTestPanelWidth(300);
		flushSync(() => notifyResize(result.find('#test-group')));
		flushSync(() => groupRef.current?.setLayout({ left: 55, right: 45 }));
		const separator = result.find('#separator');

		expect(separator.getAttribute('role')).toBe('separator');
		expect(separator.getAttribute('aria-orientation')).toBe('vertical');
		expect(separator.getAttribute('aria-controls')).toBe('left');
		expect(separator.getAttribute('aria-valuemin')).toBe('0');
		expect(separator.getAttribute('aria-valuemax')).toBe('80');
		expect(separator.getAttribute('aria-valuenow')).toBe('55');
	});
});
