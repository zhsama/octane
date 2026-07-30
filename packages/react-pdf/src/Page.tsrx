'use client';

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'octane';
import type { OctaneNode } from 'octane';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { StructTreeNode, TextContent } from 'pdfjs-dist/types/src/display/api.js';
import { useDocumentContext, PageContext } from './contexts.tsrx';
import LinkService from './LinkService';
import Message from './Message.tsrx';
import AnnotationLayer from './Page/AnnotationLayer.tsrx';
import Canvas from './Page/Canvas.tsrx';
import TextLayer from './Page/TextLayer.tsrx';
import type {
	Annotations,
	ClassName,
	CustomRenderer,
	CustomTextRenderer,
	FilterAnnotations,
	HostProps,
	NodeOrRenderer,
	PageCallback,
	PageColors,
	PageContextType,
	PageRenderProps,
	Ref,
	RenderMode,
} from './types';
import { invariant, isProvided, makePageCallback, resolveNode, warn } from './utils';

type PageState =
	| { pdf: PDFDocumentProxy | false | undefined; pageNumber: number | null; status: 'loading' }
	| {
			pdf: PDFDocumentProxy;
			pageNumber: number;
			status: 'loaded';
			page: PDFPageProxy;
	  }
	| {
			pdf: PDFDocumentProxy;
			pageNumber: number;
			status: 'error';
			error: Error;
	  };

export type PageProps =
	{
		_className?: string;
		_enableRegisterUnregisterPage?: boolean;
		canvasBackground?: string;
		canvasRef?: Ref<HTMLCanvasElement>;
		children?: OctaneNode | ((props: PageRenderProps) => OctaneNode);
		className?: ClassName;
		customRenderer?: CustomRenderer;
		customTextRenderer?: CustomTextRenderer;
		devicePixelRatio?: number;
		error?: NodeOrRenderer;
		filterAnnotations?: FilterAnnotations;
		height?: number;
		imageResourcesPath?: string;
		inputRef?: Ref<HTMLDivElement>;
		loading?: NodeOrRenderer;
		noData?: NodeOrRenderer;
		onGetAnnotationsError?: (error: Error) => void;
		onGetAnnotationsSuccess?: (annotations: Annotations) => void;
		onGetStructTreeError?: (error: Error) => void;
		onGetStructTreeSuccess?: (tree: StructTreeNode) => void;
		onGetTextError?: (error: Error) => void;
		onGetTextSuccess?: (text: TextContent) => void;
		onLoadError?: (error: Error) => void;
		onLoadSuccess?: (page: PageCallback) => void;
		onRenderAnnotationLayerError?: (error: unknown) => void;
		onRenderAnnotationLayerSuccess?: () => void;
		onRenderError?: (error: Error) => void;
		onRenderSuccess?: (page: PageCallback) => void;
		onRenderTextLayerError?: (error: Error) => void;
		onRenderTextLayerSuccess?: () => void;
		pageColors?: PageColors;
		pageIndex?: number;
		pageNumber?: number;
		pdf?: PDFDocumentProxy | false;
		renderAnnotationLayer?: boolean;
		renderForms?: boolean;
		renderMode?: RenderMode;
		renderTextLayer?: boolean;
		rotate?: number | null;
		scale?: number;
		width?: number;
	} & Omit<HostProps<HTMLDivElement>, 'style'>;

export default function Page(props: PageProps) {
	const documentContext = useDocumentContext();
	const localLinkService = useRef(new LinkService());
	const localLinkServiceDocument = useRef<PDFDocumentProxy | false | undefined>(undefined);
	const merged = { ...documentContext, ...props };
	const {
		_className = 'react-pdf__Page',
		_enableRegisterUnregisterPage = true,
		canvasBackground,
		canvasRef,
		children,
		className,
		customRenderer: CustomRenderer,
		customTextRenderer,
		devicePixelRatio,
		error = 'Failed to load the page.',
		filterAnnotations,
		height,
		imageResourcesPath,
		inputRef,
		linkService: documentLinkService,
		loading = 'Loading page…',
		noData = 'No page specified.',
		onGetAnnotationsError,
		onGetAnnotationsSuccess,
		onGetStructTreeError,
		onGetStructTreeSuccess,
		onGetTextError,
		onGetTextSuccess,
		onItemClick: _onItemClick,
		onLoadError,
		onLoadSuccess,
		onRenderAnnotationLayerError,
		onRenderAnnotationLayerSuccess,
		onRenderError,
		onRenderSuccess,
		onRenderTextLayerError,
		onRenderTextLayerSuccess,
		pageColors,
		pageIndex: pageIndexProp,
		pageNumber: pageNumberProp,
		pdf,
		registerPage,
		renderAnnotationLayer = true,
		renderForms = false,
		renderMode = 'canvas',
		renderTextLayer = true,
		rotate: rotateProp,
		scale: scaleProp = 1,
		unregisterPage,
		width,
		...hostProps
	} = merged;
	invariant(
		pdf !== null && pdf !== undefined,
		'Attempted to load a page, but no document was specified. Wrap <Page /> in <Document /> or pass pdf.',
	);
	const pageIndex = isProvided(pageNumberProp) ? pageNumberProp - 1 : pageIndexProp ?? null;
	const pageNumber = pageNumberProp ?? (isProvided(pageIndexProp) ? pageIndexProp + 1 : null);
	const [pageState, setPageState] = useState<PageState>({ pdf, pageNumber, status: 'loading' });
	const pageElement = useRef<HTMLDivElement | null>(null);
	const onLoadSuccessEvent = useEffectEvent((page: PageCallback) => onLoadSuccess?.(page));
	const onLoadErrorEvent = useEffectEvent((nextError: Error) => onLoadError?.(nextError));

	useEffect(() => {
		let active = true;
		setPageState({ pdf, pageNumber, status: 'loading' });
		if (!pdf || !pageNumber) {
			return () => {
				active = false;
			};
		}
		void pdf.getPage(pageNumber).then(
			(page) => {
				if (!active) return;
				setPageState({ pdf, pageNumber, status: 'loaded', page });
			},
			(reason) => {
				if (!active) return;
				const nextError =
					reason instanceof Error ? reason : new Error(String(reason));
				setPageState({ pdf, pageNumber, status: 'error', error: nextError });
				warn(nextError);
				onLoadErrorEvent(nextError);
			},
		);
		return () => {
			active = false;
		};
	}, [pdf, pageNumber]);

	const currentPageState =
		pageState.pdf === pdf && pageState.pageNumber === pageNumber
			? pageState
			: { pdf, pageNumber, status: 'loading' } as const;
	const page =
		currentPageState.status === 'loaded' ? currentPageState.page : undefined;
	const rotate = rotateProp ?? page?.rotate ?? 0;
	const scale = useMemo(() => {
		if (!page) return scaleProp ?? 1;
		let pageScale = 1;
		if (width || height) {
			const viewport = page.getViewport({ scale: 1, rotation: rotate });
			pageScale = width ? width / viewport.width : height as number / viewport.height;
		}
		return (scaleProp ?? 1) * pageScale;
	}, [height, page, rotate, scaleProp, width]);

	useEffect(() => {
		if (page) onLoadSuccessEvent(makePageCallback(page, scale));
	}, [page, scale]);

	useEffect(() => {
		if (
			!page || !isProvided(pageIndex) || !pageElement.current || !_enableRegisterUnregisterPage ||
				!registerPage
		) {
			return;
		}
		registerPage(pageIndex, pageElement.current);
		return () => unregisterPage?.(pageIndex);
	}, [
		_enableRegisterUnregisterPage,
		page,
		pageIndex,
		registerPage,
		unregisterPage,
	]);

	const linkService = documentLinkService ?? localLinkService.current;
	if (!documentLinkService && localLinkServiceDocument.current !== pdf) {
		localLinkServiceDocument.current = pdf;
		localLinkService.current.setDocument(pdf || null);
	} else if (documentLinkService && localLinkServiceDocument.current !== undefined) {
		localLinkServiceDocument.current = undefined;
		localLinkService.current.setDocument(null);
	}
	useEffect(
		() => () => {
			localLinkService.current.setDocument(null);
		},
		[],
	);
	const context = useMemo<PageContextType>(
		() => page && pdf && isProvided(pageIndex) && pageNumber
			? {
					_className,
					canvasBackground,
					customTextRenderer,
					devicePixelRatio,
					filterAnnotations,
					imageResourcesPath,
					linkService,
					onGetAnnotationsError,
					onGetAnnotationsSuccess,
					onGetStructTreeError,
					onGetStructTreeSuccess,
					onGetTextError,
					onGetTextSuccess,
					onRenderAnnotationLayerError,
					onRenderAnnotationLayerSuccess,
					onRenderError,
					onRenderSuccess,
					onRenderTextLayerError,
					onRenderTextLayerSuccess,
					page,
					pageColors,
					pageIndex,
					pageNumber,
					pdf,
					renderForms,
					renderTextLayer,
					rotate,
					scale,
				}
			: null,
		[
			_className,
			canvasBackground,
			customTextRenderer,
			devicePixelRatio,
			filterAnnotations,
			imageResourcesPath,
			linkService,
			onGetAnnotationsError,
			onGetAnnotationsSuccess,
			onGetStructTreeError,
			onGetStructTreeSuccess,
			onGetTextError,
			onGetTextSuccess,
			onRenderAnnotationLayerError,
			onRenderAnnotationLayerSuccess,
			onRenderError,
			onRenderSuccess,
			onRenderTextLayerError,
			onRenderTextLayerSuccess,
			page,
			pageColors,
			pageIndex,
			pageNumber,
			pdf,
			renderForms,
			renderTextLayer,
			rotate,
			scale,
		],
	);

	let content: OctaneNode;
	if (!pageNumber) {
		content = <Message type="no-data">{resolveNode(noData)}</Message>;
	} else if (pdf === false || currentPageState.status === 'error') {
		content = <Message type="error">{resolveNode(error)}</Message>;
	} else if (!page || !context) {
		content = <Message type="loading">{resolveNode(loading)}</Message>;
	} else {
		let mainLayer: OctaneNode = null;
		if (renderMode === 'custom') {
			invariant(CustomRenderer, 'renderMode="custom" requires customRenderer.');
			mainLayer = <CustomRenderer />;
		} else if (renderMode === 'canvas') {
			mainLayer = <Canvas canvasRef={canvasRef} />;
		}
		const fulfilled = context as PageRenderProps;
		const resolvedChildren =
			typeof children === 'function' ? children(fulfilled) : children;
		content = <PageContext.Provider value={context}>
			{mainLayer}
			{renderTextLayer ? <TextLayer /> : null}
			{renderAnnotationLayer ? <AnnotationLayer /> : null}
			{resolvedChildren}
		</PageContext.Provider>;
	}

	return <div
		{...hostProps}
		class={[_className, className]}
		data-page-number={pageNumber ?? undefined}
		ref={[inputRef, pageElement]}
		style={{
			'--scale-round-x': '1px',
			'--scale-round-y': '1px',
			'--scale-factor': '1',
			'--user-unit': `${scale}`,
			'--total-scale-factor': 'calc(var(--scale-factor) * var(--user-unit))',
			backgroundColor: canvasBackground || 'white',
			position: 'relative',
			minWidth: 'min-content',
			minHeight: 'min-content',
		} as never}
	>{content}</div>;
}
