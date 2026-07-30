'use client';

import { useDocumentContext } from './contexts.tsrx';
import Page from './Page.tsrx';
import type { PageProps } from './Page.tsrx';
import type { ClassName, OnItemClickArgs } from './types';
import { invariant, isProvided } from './utils';

export type ThumbnailProps =
	Omit<
		PageProps,
		| 'className'
		| 'customTextRenderer'
		| 'onGetAnnotationsError'
		| 'onGetAnnotationsSuccess'
		| 'onGetTextError'
		| 'onGetTextSuccess'
		| 'onRenderAnnotationLayerError'
		| 'onRenderAnnotationLayerSuccess'
		| 'onRenderTextLayerError'
		| 'onRenderTextLayerSuccess'
		| 'renderAnnotationLayer'
		| 'renderForms'
		| 'renderTextLayer'
	> & {
		className?: ClassName;
		onItemClick?: (args: OnItemClickArgs) => void;
	};

export default function Thumbnail(props: ThumbnailProps) {
	const documentContext = useDocumentContext();
	const merged = { ...documentContext, ...props };
	const {
		className,
		linkService,
		onItemClick,
		pageIndex: pageIndexProp,
		pageNumber: pageNumberProp,
		pdf,
	} = merged;
	invariant(
		pdf,
		'Attempted to load a thumbnail, but no document was specified. Wrap <Thumbnail /> in <Document /> or pass pdf.',
	);
	const pageIndex = isProvided(pageNumberProp) ? pageNumberProp - 1 : pageIndexProp ?? null;
	const pageNumber = pageNumberProp ?? (isProvided(pageIndexProp) ? pageIndexProp + 1 : null);
	const onClick = (event: MouseEvent) => {
		event.preventDefault();
		if (!isProvided(pageIndex) || !pageNumber) return;
		invariant(
			onItemClick || linkService,
			'Thumbnail navigation requires onItemClick or linkService.',
		);
		if (onItemClick) onItemClick({ pageIndex, pageNumber });
		else linkService?.goToPage(pageNumber);
	};
	const { className: _className, onItemClick: _onItemClick, ...pageProps } = props;
	return <a
		class={['react-pdf__Thumbnail', className]}
		href={pageNumber ? '#' : undefined}
		onClick={onClick}
	>
		<Page
			{...pageProps}
			_className="react-pdf__Thumbnail__page"
			_enableRegisterUnregisterPage={false}
			pdf={pdf}
			renderAnnotationLayer={false}
			renderTextLayer={false}
		/>
	</a>;
}
