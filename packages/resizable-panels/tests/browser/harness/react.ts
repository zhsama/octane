import { createElement, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import {
	Group,
	Panel,
	Separator,
	type GroupImperativeHandle,
	type Layout,
	type LayoutChangedMeta,
} from 'react-resizable-panels';

function ReactHarness() {
	const groupRef = useRef<GroupImperativeHandle | null>(null);
	const [result, setResult] = useState('');
	const style = { width: '600px', height: '240px' } satisfies CSSProperties;
	const onLayoutChanged = (layout: Layout, meta: LayoutChangedMeta) => {
		setResult(JSON.stringify({ layout, meta }));
	};

	return createElement(
		'main',
		null,
		createElement(
			'button',
			{
				id: 'set-horizontal-layout',
				onClick: () => groupRef.current?.setLayout({ left: 30, right: 70 }),
			},
			'set horizontal layout',
		),
		createElement(
			Group,
			{
				id: 'horizontal-group',
				groupRef,
				defaultLayout: { left: 50, right: 50 },
				style,
				onLayoutChanged,
			},
			createElement(
				Panel,
				{
					id: 'left',
					minSize: '20%',
					maxSize: '80%',
				},
				'left',
			),
			createElement(Separator, {
				id: 'horizontal-separator',
				'aria-label': 'horizontal resize',
			}),
			createElement(Panel, { id: 'right', minSize: '20%' }, 'right'),
		),
		createElement('output', { id: 'horizontal-result' }, result),
	);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
	throw new Error('Missing #root');
}
createRoot(rootElement).render(createElement(ReactHarness));
