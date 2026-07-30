'use client';

import { useEffect, useEffectEvent, useMemo, useRef } from 'octane';
import * as pdfjs from 'pdfjs-dist';
import type { RenderParameters } from 'pdfjs-dist/types/src/display/api.js';
import { usePageContext } from '../contexts.tsrx';
import StructTree from '../StructTree.tsrx';
import type { Ref } from '../types';
import { getDevicePixelRatio, invariant, isAbortException, makePageCallback, warn } from '../utils';

export type CanvasProps = {
	canvasRef?: Ref<HTMLCanvasElement>;
};

export default function Canvas({ canvasRef }: CanvasProps) {
	const context = usePageContext();
	invariant(context, 'Unable to find Page context.');
	const {
		_className = 'react-pdf__Page',
		canvasBackground,
		devicePixelRatio = getDevicePixelRatio(),
		onRenderError,
		onRenderSuccess,
		page,
		pageColors,
		renderForms,
		renderTextLayer,
		rotate,
		scale,
	} = context;
	const canvasElement = useRef<HTMLCanvasElement | null>(null);
	const generation = useRef(0);
	const onRenderErrorEvent = useEffectEvent((error: Error) => onRenderError?.(error));
	const onRenderSuccessEvent = useEffectEvent(
		() => onRenderSuccess?.(makePageCallback(page, scale)),
	);
	const renderViewport = useMemo(
		() => page.getViewport({ scale: scale * devicePixelRatio, rotation: rotate }),
		[devicePixelRatio, page, rotate, scale],
	);
	const viewport = useMemo(() => page.getViewport({ scale, rotation: rotate }), [
		page,
		rotate,
		scale,
	]);

	useEffect(() => {
		const canvas = canvasElement.current;
		if (!canvas) return;
		const currentGeneration = ++generation.current;
		let active = true;
		page.cleanup();
		canvas.width = renderViewport.width;
		canvas.height = renderViewport.height;
		canvas.style.width = `${Math.floor(viewport.width)}px`;
		canvas.style.height = `${Math.floor(viewport.height)}px`;
		canvas.style.visibility = 'hidden';
		const canvasContext = canvas.getContext('2d', { alpha: false });
		if (!canvasContext) {
			const error = new Error('Unable to acquire a 2D canvas context.');
			onRenderErrorEvent(error);
			return;
		}
		const parameters: RenderParameters = {
			annotationMode: renderForms ? pdfjs.AnnotationMode.ENABLE_FORMS : pdfjs.AnnotationMode.ENABLE,
			canvas,
			canvasContext,
			pageColors,
			viewport: renderViewport,
		};
		if (canvasBackground) parameters.background = canvasBackground;
		const task = page.render(parameters);
		void task.promise.then(
			() => {
				if (
					!active || generation.current !== currentGeneration || canvasElement.current !== canvas
				) {
					return;
				}
				canvas.style.visibility = '';
				onRenderSuccessEvent();
			},
			(reason) => {
				if (!active || generation.current !== currentGeneration || isAbortException(reason)) return;
				const error =
					reason instanceof Error ? reason : new Error(String(reason));
				warn(error);
				onRenderErrorEvent(error);
			},
		);
		return () => {
			active = false;
			task.cancel();
			if (canvasElement.current === canvas) {
				canvas.width = 0;
				canvas.height = 0;
			}
		};
	}, [
		canvasBackground,
		page,
		pageColors,
		renderForms,
		renderViewport,
		scale,
		viewport,
	]);

	return <canvas
		class={`${_className}__canvas`}
		dir="ltr"
		ref={canvasRef ? [canvasRef, canvasElement] : canvasElement}
		style={{ display: 'block', userSelect: 'none' }}
	>
		{renderTextLayer ? <StructTree /> : null}
	</canvas>;
}
