'use client';

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'octane';
import * as pdfjs from 'pdfjs-dist';
import type {
	PDFPageProxy,
	TextContent,
	TextItem,
	TextMarkedContent,
} from 'pdfjs-dist/types/src/display/api.js';
import { usePageContext } from '../contexts.tsrx';
import { invariant, isAbortException, warn } from '../utils';

const BLOCKED_TAGS = new Set([
	'base',
	'embed',
	'iframe',
	'link',
	'meta',
	'object',
	'script',
	'style',
	'template',
]);
const URL_ATTRIBUTES = new Set(['action', 'formaction', 'href', 'poster', 'src', 'xlink:href']);

type TextState =
	| { page: PDFPageProxy; status: 'loading' }
	| { page: PDFPageProxy; status: 'loaded'; textContent: TextContent }
	| { page: PDFPageProxy; status: 'error'; error: Error };

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
	return 'str' in item;
}

function isDangerousUrl(value: string): boolean {
	const normalized = [...value].filter((character) => {
		const code = character.charCodeAt(0);
		return code > 32 && code !== 127;
	}).join('').toLowerCase();
	return normalized.startsWith('javascript:') || normalized.startsWith('vbscript:');
}

function sanitizeNode(node: ChildNode): Node {
	if (!(node instanceof HTMLElement) || BLOCKED_TAGS.has(node.tagName.toLowerCase())) {
		return document.createTextNode(node.textContent ?? '');
	}
	const element = document.createElement(node.tagName.toLowerCase());
	for (const attribute of node.attributes) {
		const name = attribute.name.toLowerCase();
		if (name.startsWith('on') || name === 'srcdoc') continue;
		if (URL_ATTRIBUTES.has(name) && isDangerousUrl(attribute.value)) continue;
		element.setAttribute(attribute.name, attribute.value);
	}
	for (const child of node.childNodes) element.append(sanitizeNode(child));
	return element;
}

function renderSafeCustomText(target: Element, content: string): void {
	const template = document.createElement('template');
	template.innerHTML = content;
	const fragment = document.createDocumentFragment();
	for (const child of template.content.childNodes) fragment.append(sanitizeNode(child));
	target.replaceChildren(fragment);
}

export default function TextLayer() {
	const context = usePageContext();
	invariant(context, 'Unable to find Page context.');
	const {
		customTextRenderer,
		onGetTextError,
		onGetTextSuccess,
		onRenderTextLayerError,
		onRenderTextLayerSuccess,
		page,
		pageIndex,
		pageNumber,
		rotate,
		scale,
	} = context;
	const layerElement = useRef<HTMLDivElement | null>(null);
	const generation = useRef(0);
	const [state, setState] = useState<TextState>({ page, status: 'loading' });
	const onGetTextErrorEvent = useEffectEvent((error: Error) => onGetTextError?.(error));
	const onGetTextSuccessEvent = useEffectEvent(
		(textContent: TextContent) => onGetTextSuccess?.(textContent),
	);
	const onRenderTextLayerErrorEvent = useEffectEvent(
		(error: Error) => onRenderTextLayerError?.(error),
	);
	const onRenderTextLayerSuccessEvent = useEffectEvent(() => onRenderTextLayerSuccess?.());
	const viewport = useMemo(() => page.getViewport({ scale, rotation: rotate }), [
		page,
		rotate,
		scale,
	]);

	useEffect(() => {
		let active = true;
		setState({ page, status: 'loading' });
		void page.getTextContent().then(
			(textContent) => {
				if (!active) return;
				setState({ page, status: 'loaded', textContent });
				onGetTextSuccessEvent(textContent);
			},
			(reason) => {
				if (!active) return;
				const error =
					reason instanceof Error ? reason : new Error(String(reason));
				setState({ page, status: 'error', error });
				warn(error);
				onGetTextErrorEvent(error);
			},
		);
		return () => {
			active = false;
		};
	}, [page]);

	const current =
		state.page === page ? state : { page, status: 'loading' } as const;
	const textContent =
		current.status === 'loaded' ? current.textContent : undefined;

	useLayoutEffect(() => {
		const layer = layerElement.current;
		if (!layer) return;
		const currentGeneration = ++generation.current;
		let active = true;
		let renderTask: InstanceType<typeof pdfjs.TextLayer> | undefined;
		layer.replaceChildren();
		if (!textContent) {
			return () => {
				active = false;
			};
		}

		void (async () => {
			try {
				renderTask = new pdfjs.TextLayer({
					container: layer,
					textContentSource: page.streamTextContent({ includeMarkedContent: true }),
					viewport,
				});
				await renderTask.render();
				if (!active || generation.current !== currentGeneration || layerElement.current !== layer) {
					return;
				}
				if (customTextRenderer) {
					const children = layer.querySelectorAll('[role="presentation"]');
					let childIndex = 0;
					textContent.items.forEach((item, itemIndex) => {
						if (!isTextItem(item)) return;
						const child = children[childIndex];
						if (child) {
							renderSafeCustomText(
								child,
								customTextRenderer({ pageIndex, pageNumber, itemIndex, ...item }),
							);
						}
						childIndex += item.str && item.hasEOL ? 2 : 1;
					});
				}
				const end = document.createElement('div');
				end.className = 'endOfContent';
				layer.append(end);
				onRenderTextLayerSuccessEvent();
			} catch (reason) {
				if (!active || generation.current !== currentGeneration || isAbortException(reason)) return;
				const error =
					reason instanceof Error ? reason : new Error(String(reason));
				warn(error);
				onRenderTextLayerErrorEvent(error);
			}
		})();

		return () => {
			active = false;
			renderTask?.cancel();
			if (layerElement.current === layer) layer.replaceChildren();
		};
	}, [
		customTextRenderer,
		page,
		pageIndex,
		pageNumber,
		textContent,
		viewport,
	]);

	const onMouseDown = () => layerElement.current?.classList.add('selecting');
	const onMouseUp = () => layerElement.current?.classList.remove('selecting');

	return <div
		class="react-pdf__Page__textContent textLayer"
		onMouseDown={onMouseDown}
		onMouseUp={onMouseUp}
		ref={layerElement}
	/>;
}
