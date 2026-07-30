import {
	Group,
	Panel,
	Separator,
	type GroupImperativeHandle,
	type PanelImperativeHandle,
} from '@octanejs/resizable-panels';
import { createRoot, delegateEvents, useRef, useState } from 'octane';

delegateEvents(['click']);

function BrowserHarness() @{
	const horizontalGroupRef = useRef<GroupImperativeHandle | null>(null);
	const horizontalPanelRef = useRef<PanelImperativeHandle | null>(null);
	const [horizontalResult, setHorizontalResult] = useState('');
	const [minimumTargetSize, setMinimumTargetSize] = useState(2);
	const [resizeHandler, setResizeHandler] = useState<'first' | 'second'>('first');
	const [resizeResult, setResizeResult] = useState('');
	const [verticalResult, setVerticalResult] = useState('');

	const onResize =
		resizeHandler === 'first'
			? (size) => setResizeResult(`first:${size.asPercentage}`)
			: (size) => setResizeResult(`second:${size.asPercentage}`);

	<main>
		<div class="controls">
			<button
				id="set-horizontal-half"
				onClick={() => horizontalGroupRef.current?.setLayout({ left: 50, right: 50 })}
			>
				reset horizontal
			</button>
			<button
				id="set-horizontal-layout"
				onClick={() => horizontalGroupRef.current?.setLayout({ left: 30, right: 70 })}
			>
				set horizontal layout
			</button>
			<button id="collapse-left" onClick={() => horizontalPanelRef.current?.collapse()}>
				collapse left
			</button>
			<button id="expand-left" onClick={() => horizontalPanelRef.current?.expand()}>
				expand left
			</button>
			<button id="resize-left" onClick={() => horizontalPanelRef.current?.resize('40%')}>
				resize left
			</button>
			<button id="widen-resize-target" onClick={() => setMinimumTargetSize(48)}>
				widen resize target
			</button>
			<button id="switch-resize-handler" onClick={() => setResizeHandler('second')}>
				switch resize handler
			</button>
		</div>

		<Group
			id="horizontal-group"
			groupRef={horizontalGroupRef}
			defaultLayout={{ left: 50, right: 50 }}
			resizeTargetMinimumSize={{
				coarse: minimumTargetSize,
				fine: minimumTargetSize,
			}}
			style={{ width: '600px', height: '240px' }}
			onLayoutChanged={(layout, meta) => setHorizontalResult(JSON.stringify({ layout, meta }))}
		>
			<Panel
				id="left"
				panelRef={horizontalPanelRef}
				collapsible
				collapsedSize="0%"
				minSize="20%"
				maxSize="80%"
				onResize={onResize}
			>
				left
			</Panel>
			<Separator id="horizontal-separator" aria-label="horizontal resize" />
			<Panel id="right" minSize="20%">
				right
			</Panel>
		</Group>
		<output id="horizontal-result">{horizontalResult as string}</output>
		<output id="resize-result">{resizeResult as string}</output>

		<Group
			id="vertical-group"
			orientation="vertical"
			defaultLayout={{ top: 50, bottom: 50 }}
			style={{ width: '320px', height: '400px' }}
			onLayoutChanged={(layout, meta) => setVerticalResult(JSON.stringify({ layout, meta }))}
		>
			<Panel id="top" minSize="20%">
				top
			</Panel>
			<Separator id="vertical-separator" aria-label="vertical resize" />
			<Panel id="bottom" minSize="20%">
				bottom
			</Panel>
		</Group>
		<output id="vertical-result">{verticalResult as string}</output>
	</main>
}

const rootElement = document.getElementById('root');
if (!rootElement) {
	throw new Error('Missing #root');
}

createRoot(rootElement).render(BrowserHarness);
