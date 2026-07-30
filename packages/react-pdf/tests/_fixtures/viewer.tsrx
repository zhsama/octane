import { Document, Page } from '@octanejs/react-pdf';
import type {
	DocumentHandle,
	DocumentProps,
	File,
	PageCallback,
	PageProps,
} from '@octanejs/react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export type DocumentFixtureProps = {
	file: File;
	onLoadError?: (error: Error) => void;
	onLoadProgress?: DocumentProps['onLoadProgress'];
	onLoadSuccess?: (pdf: PDFDocumentProxy) => void;
	onPassword?: DocumentProps['onPassword'];
	onSourceError?: (error: Error) => void;
	onSourceSuccess?: () => void;
	options?: DocumentProps['options'];
	pageNumber?: number;
	ref?: DocumentProps['ref'];
};

export function DocumentFixture({
	file,
	onLoadError,
	onLoadProgress,
	onLoadSuccess,
	onPassword,
	onSourceError,
	onSourceSuccess,
	options,
	pageNumber = 1,
	ref,
}: DocumentFixtureProps) {
	return <Document
		file={file}
		onLoadError={onLoadError}
		onLoadProgress={onLoadProgress}
		onLoadSuccess={onLoadSuccess}
		onPassword={onPassword}
		onSourceError={onSourceError}
		onSourceSuccess={onSourceSuccess}
		options={options}
		ref={ref}
	>
		{({ pdf }) => <>
			<output id="document-id">{(pdf as PDFDocumentProxy & { id: string }).id}</output>
			<Page
				pageNumber={pageNumber}
				renderAnnotationLayer={false}
				renderMode="none"
				renderTextLayer={false}
			/>
		</>}
	</Document>;
}

export type PageFixtureProps = {
	devicePixelRatio?: number;
	onLoadError?: (error: Error) => void;
	onLoadSuccess?: (page: PageCallback) => void;
	onGetStructTreeSuccess?: PageProps['onGetStructTreeSuccess'];
	onRenderAnnotationLayerSuccess?: () => void;
	onRenderSuccess?: (page: PageCallback) => void;
	onRenderTextLayerSuccess?: () => void;
	pageNumber: number;
	pdf: PDFDocumentProxy;
	renderAnnotationLayer?: boolean;
	renderForms?: boolean;
	renderMode?: PageProps['renderMode'];
	renderTextLayer?: boolean;
	width?: number;
};

export function PageFixture({
	devicePixelRatio,
	onLoadError,
	onLoadSuccess,
	onGetStructTreeSuccess,
	onRenderAnnotationLayerSuccess,
	onRenderSuccess,
	onRenderTextLayerSuccess,
	pageNumber,
	pdf,
	renderAnnotationLayer = false,
	renderForms = false,
	renderMode = 'none',
	renderTextLayer = false,
	width,
}: PageFixtureProps) {
	return <Page
		devicePixelRatio={devicePixelRatio}
		onLoadError={onLoadError}
		onGetStructTreeSuccess={onGetStructTreeSuccess}
		onLoadSuccess={onLoadSuccess}
		onRenderAnnotationLayerSuccess={onRenderAnnotationLayerSuccess}
		onRenderSuccess={onRenderSuccess}
		onRenderTextLayerSuccess={onRenderTextLayerSuccess}
		pageNumber={pageNumber}
		pdf={pdf}
		renderAnnotationLayer={renderAnnotationLayer}
		renderForms={renderForms}
		renderMode={renderMode}
		renderTextLayer={renderTextLayer}
		width={width}
	>
		{({ page }) => <output id="page-id">{(page as PDFPageProxy & { id: string }).id}</output>}
	</Page>;
}

export function TwoDocuments({
	firstRef,
	onLoad,
	secondRef,
}: {
	firstRef: (handle: DocumentHandle | null) => void;
	onLoad: (id: string) => void;
	secondRef: (handle: DocumentHandle | null) => void;
}) {
	return <section>
		<Document
			file="/first.pdf"
			ref={firstRef}
			onLoadSuccess={(pdf) => onLoad((pdf as PDFDocumentProxy & { id: string }).id)}
		>
			<Page
				pageNumber={1}
				renderAnnotationLayer={false}
				renderMode="none"
				renderTextLayer={false}
			/>
		</Document>
		<Document
			file="/second.pdf"
			ref={secondRef}
			onLoadSuccess={(pdf) => onLoad((pdf as PDFDocumentProxy & { id: string }).id)}
		>
			<Page
				pageNumber={1}
				renderAnnotationLayer={false}
				renderMode="none"
				renderTextLayer={false}
			/>
		</Document>
	</section>;
}

import type { PDFPageProxy } from 'pdfjs-dist';
