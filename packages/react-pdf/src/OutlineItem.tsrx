'use client';

import { useEffect, useEffectEvent, useRef } from 'octane';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useOutlineContext } from './contexts.tsrx';
import type LinkService from './LinkService';
import { invariant, warn } from './utils';

type PDFOutline = NonNullable<Awaited<ReturnType<PDFDocumentProxy['getOutline']>>>;
type PDFOutlineItem = PDFOutline[number];

export type OutlineItemProps = {
	item: PDFOutlineItem;
	linkService?: LinkService;
	pdf: PDFDocumentProxy;
};

export default function OutlineItem({ item, linkService, pdf }: OutlineItemProps) @{
	const outlineContext = useOutlineContext();
	invariant(outlineContext, 'Unable to find Outline context.');
	const { onItemClick } = outlineContext;
	const active = useRef(true);
	const clickGeneration = useRef(0);
	const onItemClickEvent = useEffectEvent(
		(args: Parameters<NonNullable<typeof onItemClick>>[0]) => onItemClick?.(args),
	);

	useEffect(() => {
		active.current = true;
		clickGeneration.current += 1;
		return () => {
			active.current = false;
			clickGeneration.current += 1;
		};
	}, [item, pdf]);

	const onClick = (event: MouseEvent) => {
		event.preventDefault();
		invariant(
			onItemClick || linkService,
			'Either onItemClick or linkService is required to navigate to an outline item.',
		);
		if (!onItemClick) {
			void linkService?.goToDestination(item.dest);
			return;
		}
		const currentGeneration = ++clickGeneration.current;
		void (async () => {
			const dest =
				typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
			if (!dest) throw new Error('Destination not found.');
			const reference = dest[0];
			const pageIndex =
				typeof reference === 'number' ? reference : await pdf.getPageIndex(reference);
			if (active.current && clickGeneration.current === currentGeneration) {
				onItemClickEvent({ dest, pageIndex, pageNumber: pageIndex + 1 });
			}
		})().catch(warn);
	};
	const subitems = item.items ?? [];
	const keyedSubitems = subitems.map(
		(child, index) => ({
			child,
			key: typeof child.dest === 'string' ? child.dest : index,
		}),
	);

	<li>
		<a href="#" onClick={onClick}>{item.title}</a>
		@if (keyedSubitems.length > 0) {
			<ul>
				@for (const entry of keyedSubitems; key entry.key) {
					<OutlineItem item={entry.child} linkService={linkService} pdf={pdf} />
				}
			</ul>
		}
	</li>
}
