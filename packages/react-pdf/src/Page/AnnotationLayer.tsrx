'use client';

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'octane';
import * as pdfjs from 'pdfjs-dist';
import type { PDFPageProxy } from 'pdfjs-dist';
import type { AnnotationLayerParameters } from 'pdfjs-dist/types/src/display/annotation_layer.js';
import { usePageContext } from '../contexts.tsrx';
import { invariant, warn } from '../utils';
import type { Annotations } from '../types';

type AnnotationState =
	| { page: PDFPageProxy; status: 'loading' }
	| { page: PDFPageProxy; status: 'loaded'; annotations: Annotations }
	| { page: PDFPageProxy; status: 'error'; error: Error };

function commitRenderedLayer(target: HTMLDivElement, rendered: HTMLDivElement): void {
	for (const attribute of [...target.attributes]) {
		if (attribute.name !== 'class') target.removeAttribute(attribute.name);
	}
	for (const attribute of [...rendered.attributes]) {
		if (attribute.name !== 'class') target.setAttribute(attribute.name, attribute.value);
	}
	target.replaceChildren(...rendered.childNodes);
}

export default function AnnotationLayer() {
	const context = usePageContext();
	invariant(context, 'Unable to find Page context.');
	const {
		filterAnnotations,
		imageResourcesPath,
		linkService,
		onGetAnnotationsError,
		onGetAnnotationsSuccess,
		onRenderAnnotationLayerError,
		onRenderAnnotationLayerSuccess,
		page,
		pdf,
		renderForms,
		rotate,
		scale,
	} = context;
	const layerElement = useRef<HTMLDivElement | null>(null);
	const generation = useRef(0);
	const [state, setState] = useState<AnnotationState>({ page, status: 'loading' });
	const onGetAnnotationsErrorEvent = useEffectEvent(
		(error: Error) => onGetAnnotationsError?.(error),
	);
	const onGetAnnotationsSuccessEvent = useEffectEvent(
		(annotations: Annotations) => onGetAnnotationsSuccess?.(annotations),
	);
	const onRenderAnnotationLayerErrorEvent = useEffectEvent(
		(error: unknown) => onRenderAnnotationLayerError?.(error),
	);
	const onRenderAnnotationLayerSuccessEvent = useEffectEvent(
		() => onRenderAnnotationLayerSuccess?.(),
	);
	const viewport = useMemo(() => page.getViewport({ scale, rotation: rotate }), [
		page,
		rotate,
		scale,
	]);

	useEffect(() => {
		let active = true;
		setState({ page, status: 'loading' });
		void page.getAnnotations().then(
			(annotations) => {
				if (!active) return;
				setState({ page, status: 'loaded', annotations });
				onGetAnnotationsSuccessEvent(annotations);
			},
			(reason) => {
				if (!active) return;
				const error =
					reason instanceof Error ? reason : new Error(String(reason));
				setState({ page, status: 'error', error });
				warn(error);
				onGetAnnotationsErrorEvent(error);
			},
		);
		return () => {
			active = false;
		};
	}, [page]);

	const current =
		state.page === page ? state : { page, status: 'loading' } as const;
	const annotations =
		current.status === 'loaded' ? current.annotations : undefined;

	useLayoutEffect(() => {
		const layer = layerElement.current;
		if (!layer) return;
		const currentGeneration = ++generation.current;
		let active = true;
		layer.replaceChildren();
		if (!annotations) {
			return () => {
				active = false;
			};
		}

		const filtered =
			filterAnnotations ? filterAnnotations({ annotations }) : annotations;
		const clonedViewport = viewport.clone({ dontFlip: true });
		const renderedLayer = document.createElement('div');
		const layerParameters = {
			accessibilityManager: null,
			annotationCanvasMap: null,
			annotationEditorUIManager: null,
			annotationStorage: pdf.annotationStorage,
			commentManager: null,
			div: renderedLayer,
			l10n: null,
			linkService,
			page,
			structTreeLayer: null,
			viewport: clonedViewport,
		};
		const renderParameters: AnnotationLayerParameters = {
			annotations: filtered,
			annotationStorage: pdf.annotationStorage,
			div: renderedLayer,
			imageResourcesPath,
			linkService,
			page,
			renderForms,
			viewport: clonedViewport,
		};
		void (async () => {
			try {
				await new pdfjs.AnnotationLayer(layerParameters).render(renderParameters);
				if (active && generation.current === currentGeneration && layerElement.current === layer) {
					commitRenderedLayer(layer, renderedLayer);
					onRenderAnnotationLayerSuccessEvent();
				}
			} catch (reason) {
				if (!active || generation.current !== currentGeneration) return;
				warn(reason);
				onRenderAnnotationLayerErrorEvent(reason);
			}
		})();

		return () => {
			active = false;
			if (layerElement.current === layer) layer.replaceChildren();
		};
	}, [
		annotations,
		filterAnnotations,
		imageResourcesPath,
		linkService,
		page,
		pdf,
		renderForms,
		viewport,
	]);

	return <div class="react-pdf__Page__annotations annotationLayer" ref={layerElement} />;
}
