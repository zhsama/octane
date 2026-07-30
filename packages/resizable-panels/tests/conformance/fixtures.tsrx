import {
	Group,
	Panel,
	Separator,
	useDefaultLayout,
	useGroupCallbackRef,
	useGroupRef,
	usePanelCallbackRef,
	usePanelRef,
} from '@octanejs/resizable-panels';

export function PanelsFixture(props) @{
	<Group
		id={props.groupId ?? 'test-group'}
		groupRef={props.groupRef}
		elementRef={props.groupElementRef}
		defaultLayout={{ left: 50, right: 50 }}
		resizeTargetMinimumSize={props.resizeTargetMinimumSize}
		onLayoutChange={props.onLayoutChange}
		onLayoutChanged={props.onLayoutChanged}
		data-extra="group-extra"
	>
		<Panel
			id="left"
			panelRef={props.panelRef}
			elementRef={props.panelElementRef}
			collapsible
			collapsedSize="0%"
			minSize="20%"
			maxSize="80%"
			onResize={props.onResize}
			data-extra="panel-extra"
		>
			left
		</Panel>
		<Separator id="separator" elementRef={props.separatorElementRef} data-extra="separator-extra" />
		<Panel id="right" minSize="20%">
			right
		</Panel>
	</Group>
}

export function TwoGroupsFixture(props) @{
	<main>
		<Group id="first-group" groupRef={props.firstRef} defaultLayout={{ first: 50, second: 50 }}>
			<Panel id="first" />
			<Panel id="second" />
		</Group>
		<Group id="second-group" groupRef={props.secondRef} defaultLayout={{ alpha: 50, omega: 50 }}>
			<Panel id="alpha" />
			<Panel id="omega" />
		</Group>
	</main>
}

export function CallbackRefFixture(props) @{
	const groupRef = useGroupCallbackRef();
	const panelRef = usePanelCallbackRef();
	props.observe(groupRef, panelRef);

	<Group id="callback-group" groupRef={groupRef[1]}>
		<Panel id="callback-left" panelRef={panelRef[1]} />
		<Panel id="callback-right" />
	</Group>
}

export function HookSlotIsolationFixture(props) @{
	const firstGroupRef = useGroupRef();
	const secondGroupRef = useGroupRef();
	const firstPanelRef = usePanelRef();
	const secondPanelRef = usePanelRef();
	props.observe({ firstGroupRef, secondGroupRef, firstPanelRef, secondPanelRef });

	<main>
		<Group
			id="slot-group-one"
			groupRef={firstGroupRef}
			defaultLayout={{ 'slot-panel-one': 40, 'slot-panel-one-tail': 60 }}
		>
			<Panel id="slot-panel-one" panelRef={firstPanelRef} />
			<Panel id="slot-panel-one-tail" />
		</Group>
		<Group
			id="slot-group-two"
			groupRef={secondGroupRef}
			defaultLayout={{ 'slot-panel-two': 70, 'slot-panel-two-tail': 30 }}
		>
			<Panel id="slot-panel-two" panelRef={secondPanelRef} />
			<Panel id="slot-panel-two-tail" />
		</Group>
	</main>
}

export function NumericPanelIdFixture(props) @{
	<Group
		id="numeric-panel-group"
		groupRef={props.groupRef}
		defaultLayout={{ 0: 35, 'numeric-panel-tail': 65 }}
	>
		<Panel id={0} onResize={props.onResize} />
		<Panel id="numeric-panel-tail" />
	</Group>
}

export function DefaultLayoutFixture(props) @{
	const layout = useDefaultLayout({
		id: props.id,
		panelIds: props.panelIds,
		storage: props.storage,
		onlySaveAfterUserInteractions: props.onlySaveAfterUserInteractions,
	});
	props.observe(layout);

	<Group id="stored-group" defaultLayout={layout.defaultLayout}>
		<Panel id="stored-left" />
		<Panel id="stored-right" />
	</Group>
}
