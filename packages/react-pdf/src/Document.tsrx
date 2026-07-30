'use client';

import { useEffect, useEffectEvent, useImperativeHandle, useMemo, useRef, useState } from 'octane';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api.js';
import { DocumentContext } from './contexts.tsrx';
import LinkService from './LinkService';
import Message from './Message.tsrx';
import PasswordResponses from './PasswordResponses';
import type {
	ClassName,
	DocumentContextType,
	DocumentHandle,
	DocumentRenderProps,
	ExternalLinkRel,
	ExternalLinkTarget,
	File,
	HostProps,
	ImageResourcesPath,
	NodeOrRenderer,
	OnItemClickArgs,
	OnLoadProgressArgs,
	OnPasswordCallback,
	Options,
	PasswordResponse,
	Ref,
	RenderMode,
	Source,
} from './types';
import { isBrowser, resolveDocumentSource, resolveNode, warn } from './utils';

type SourceState =
	| { file: File | undefined; status: 'loading' }
	| { file: File | undefined; status: 'loaded'; source: Source | null }
	| { file: File | undefined; status: 'error'; error: Error };

type PdfState =
	| { file: File | undefined; options: Options | undefined; status: 'loading' }
	| {
			file: File | undefined;
			options: Options | undefined;
			status: 'loaded';
			pdf: PDFDocumentProxy;
	  }
	| { file: File | undefined; options: Options | undefined; status: 'error'; error: Error };

export type DocumentProps =
	{
		children?: | import('octane').OctaneNode
		| ((props: DocumentRenderProps) => import('octane').OctaneNode);
		className?: ClassName;
		error?: NodeOrRenderer;
		externalLinkRel?: ExternalLinkRel;
		externalLinkTarget?: ExternalLinkTarget;
		file?: File;
		imageResourcesPath?: ImageResourcesPath;
		inputRef?: Ref<HTMLDivElement>;
		loading?: NodeOrRenderer;
		noData?: NodeOrRenderer;
		onItemClick?: (args: OnItemClickArgs) => void;
		onLoadError?: (error: Error) => void;
		onLoadProgress?: (args: OnLoadProgressArgs) => void;
		onLoadSuccess?: (document: PDFDocumentProxy) => void;
		onPassword?: (callback: OnPasswordCallback, reason: PasswordResponse) => void;
		onSourceError?: (error: Error) => void;
		onSourceSuccess?: () => void;
		options?: Options;
		ref?: Ref<DocumentHandle>;
		renderMode?: RenderMode;
		rotate?: number | null;
		scale?: number;
	} & HostProps<HTMLDivElement>;

function defaultOnPassword(callback: OnPasswordCallback, reason: PasswordResponse): void {
	if (!isBrowser) return callback(null);
	const message =
		reason === PasswordResponses.INCORRECT_PASSWORD
			? 'Invalid password. Please try again.'
			: 'Enter the password to open this PDF file.';
	callback(window.prompt(message));
}

function asError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

export default function Document({
	children,
	className,
	error = 'Failed to load PDF file.',
	externalLinkRel,
	externalLinkTarget,
	file,
	imageResourcesPath,
	inputRef,
	loading = 'Loading PDF…',
	noData = 'No PDF file specified.',
	onItemClick,
	onLoadError,
	onLoadProgress,
	onLoadSuccess,
	onPassword = defaultOnPassword,
	onSourceError,
	onSourceSuccess,
	options,
	ref,
	renderMode,
	rotate,
	scale,
	...hostProps
}: DocumentProps) {
	const [sourceState, setSourceState] = useState<SourceState>(
		() => file === null || file === undefined || file === ''
			? { file, status: 'loaded', source: null }
			: { file, status: 'loading' },
	);
	const [pdfState, setPdfState] = useState<PdfState>({ file, options, status: 'loading' });
	const linkService = useRef(new LinkService());
	const pages = useRef<HTMLDivElement[]>([]);

	const onSourceSuccessEvent = useEffectEvent(() => onSourceSuccess?.());
	const onSourceErrorEvent = useEffectEvent((nextError: Error) => onSourceError?.(nextError));
	const onLoadSuccessEvent = useEffectEvent((pdf: PDFDocumentProxy) => onLoadSuccess?.(pdf));
	const onLoadErrorEvent = useEffectEvent((nextError: Error) => onLoadError?.(nextError));
	const onLoadProgressEvent = useEffectEvent(
		(progress: OnLoadProgressArgs) => onLoadProgress?.(progress),
	);
	const onPasswordEvent = useEffectEvent(
		(callback: OnPasswordCallback, reason: PasswordResponse) => onPassword(callback, reason),
	);
	const scrollPageIntoView = useEffectEvent(({
		dest,
		pageNumber,
		pageIndex = pageNumber - 1,
	}: import('./types').ScrollPageIntoViewArgs) => {
		if (onItemClick) {
			onItemClick({ dest, pageIndex, pageNumber });
			return;
		}
		const page = pages.current[pageIndex];
		if (page) {
			page.scrollIntoView();
			return;
		}
		warn(
			`An internal link to page ${pageNumber} could not find a rendered <Page />. ` +
				'Render that page or provide Document.onItemClick.',
		);
	});
	const viewer = useRef({ scrollPageIntoView });

	useImperativeHandle(ref, () => ({ linkService, pages, viewer }), []);

	useEffect(() => {
		let active = true;
		setSourceState(
			file === null || file === undefined || file === ''
				? { file, status: 'loaded', source: null }
				: { file, status: 'loading' },
		);

		void resolveDocumentSource(file ?? null).then(
			(source) => {
				if (!active) return;
				setSourceState({ file, status: 'loaded', source });
				onSourceSuccessEvent();
			},
			(reason) => {
				if (!active) return;
				const nextError = asError(reason);
				setSourceState({ file, status: 'error', error: nextError });
				onSourceErrorEvent(nextError);
			},
		);
		return () => {
			active = false;
		};
	}, [file]);

	const currentSource =
		sourceState.file === file ? sourceState : { file, status: 'loading' } as const;
	const source =
		currentSource.status === 'loaded' ? currentSource.source : undefined;

	useEffect(() => {
		let active = true;
		setPdfState({ file, options, status: 'loading' });
		pages.current = [];
		linkService.current.setDocument(null);
		if (!source) {
			return () => {
				active = false;
			};
		}

		const parameters: DocumentInitParameters = options ? { ...source, ...options } : source;
		const loadingTask = pdfjs.getDocument(parameters);
		loadingTask.onProgress = onLoadProgressEvent;
		loadingTask.onPassword = onPasswordEvent;
		void loadingTask.promise.then(
			(pdf) => {
				if (!active || loadingTask.destroyed) return;
				pages.current = new Array(pdf.numPages);
				linkService.current.setDocument(pdf);
				setPdfState({ file, options, status: 'loaded', pdf });
				onLoadSuccessEvent(pdf);
			},
			(reason) => {
				if (!active || loadingTask.destroyed) return;
				const nextError = asError(reason);
				setPdfState({ file, options, status: 'error', error: nextError });
				onLoadErrorEvent(nextError);
			},
		);

		return () => {
			active = false;
			void loadingTask.destroy();
		};
	}, [source, options]);

	useEffect(() => {
		linkService.current.setViewer(viewer.current);
		linkService.current.setExternalLinkRel(externalLinkRel);
		linkService.current.setExternalLinkTarget(externalLinkTarget);
	}, [externalLinkRel, externalLinkTarget]);

	const currentPdf =
		pdfState.file === file && pdfState.options === options
			? pdfState
			: { file, options, status: 'loading' } as const;
	const pdf =
		currentPdf.status === 'loaded' ? currentPdf.pdf : undefined;
	const registerPage = useMemo(
		() => (pageIndex: number, element: HTMLDivElement) => {
			pages.current[pageIndex] = element;
		},
		[],
	);
	const unregisterPage = useMemo(
		() => (pageIndex: number) => {
			delete pages.current[pageIndex];
		},
		[],
	);
	const context = useMemo<DocumentContextType>(
		() => ({
			imageResourcesPath,
			linkService: linkService.current,
			onItemClick,
			pdf,
			registerPage,
			renderMode,
			rotate,
			scale,
			unregisterPage,
		}),
		[
			imageResourcesPath,
			onItemClick,
			pdf,
			registerPage,
			renderMode,
			rotate,
			scale,
			unregisterPage,
		],
	);

	let content;
	if (file === null || file === undefined || file === '') {
		content = <Message type="no-data">{resolveNode(noData)}</Message>;
	} else if (currentSource.status === 'error') {
		content = <Message type="error">{resolveNode(error)}</Message>;
	} else if (currentPdf.status === 'error') {
		content = <Message type="error">{resolveNode(error)}</Message>;
	} else if (!pdf || !context) {
		content = <Message type="loading">{resolveNode(loading)}</Message>;
	} else {
		const fulfilled = context as DocumentRenderProps;
		const resolvedChildren =
			typeof children === 'function' ? children(fulfilled) : children;
		content = <DocumentContext.Provider
			value={context}
		>{resolvedChildren}</DocumentContext.Provider>;
	}

	return <div
		class={['react-pdf__Document', className]}
		ref={inputRef}
		{...hostProps}
	>{content}</div>;
}
