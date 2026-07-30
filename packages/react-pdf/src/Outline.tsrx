'use client';

import { useEffect, useEffectEvent, useMemo, useState } from 'octane';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { OutlineContext, useDocumentContext } from './contexts.tsrx';
import OutlineItem from './OutlineItem.tsrx';
import type { ClassName, HostProps, OnItemClickArgs, Ref } from './types';
import { invariant, warn } from './utils';

type PDFOutline = NonNullable<Awaited<ReturnType<PDFDocumentProxy['getOutline']>>>;

type OutlineState =
	| { pdf: PDFDocumentProxy | false | undefined; status: 'loading' }
	| { pdf: PDFDocumentProxy; status: 'loaded'; outline: PDFOutline | null }
	| { pdf: PDFDocumentProxy; status: 'error'; error: Error };

export type OutlineProps =
	{
		className?: ClassName;
		inputRef?: Ref<HTMLDivElement>;
		onItemClick?: (props: OnItemClickArgs) => void;
		onLoadError?: (error: Error) => void;
		onLoadSuccess?: (outline: PDFOutline | null) => void;
		pdf?: PDFDocumentProxy | false;
	} & HostProps<HTMLDivElement>;

export default function Outline(props: OutlineProps) @{
	const documentContext = useDocumentContext();
	const {
		className,
		inputRef,
		onItemClick: onItemClickProp,
		onLoadError,
		onLoadSuccess,
		pdf: pdfProp,
		...hostProps
	} = props;
	const linkService = documentContext?.linkService;
	const onItemClick = onItemClickProp ?? documentContext?.onItemClick;
	const pdf = pdfProp ?? documentContext?.pdf;
	invariant(
		pdf,
		'Attempted to load an outline, but no document was specified. Wrap <Outline /> in <Document /> or pass pdf.',
	);
	const [state, setState] = useState<OutlineState>({ pdf, status: 'loading' });
	const onLoadSuccessEvent = useEffectEvent(
		(outline: PDFOutline | null) => onLoadSuccess?.(outline),
	);
	const onLoadErrorEvent = useEffectEvent((error: Error) => onLoadError?.(error));

	useEffect(() => {
		let active = true;
		setState({ pdf, status: 'loading' });
		void pdf.getOutline().then(
			(outline) => {
				if (!active) return;
				setState({ pdf, status: 'loaded', outline });
				onLoadSuccessEvent(outline);
			},
			(reason) => {
				if (!active) return;
				const error =
					reason instanceof Error ? reason : new Error(String(reason));
				setState({ pdf, status: 'error', error });
				warn(error);
				onLoadErrorEvent(error);
			},
		);
		return () => {
			active = false;
		};
	}, [pdf]);

	const context = useMemo(() => ({ onItemClick }), [onItemClick]);
	const current =
		state.pdf === pdf ? state : { pdf, status: 'loading' } as const;
	const outline =
		current.status === 'loaded' ? current.outline : null;
	const keyedOutline = outline?.map(
		(item, index) => ({
			item,
			key: typeof item.dest === 'string' ? item.dest : index,
		}),
	);

	@if (keyedOutline) {
		<div class={['react-pdf__Outline', className]} ref={inputRef} {...hostProps}>
			<OutlineContext.Provider value={context}>
				<ul>
					@for (const entry of keyedOutline; key entry.key) {
						<OutlineItem item={entry.item} linkService={linkService} pdf={pdf} />
					}
				</ul>
			</OutlineContext.Provider>
		</div>
	} @else {
		<></>
	}
}
