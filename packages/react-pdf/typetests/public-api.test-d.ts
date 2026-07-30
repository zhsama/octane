import {
	Document,
	LinkService,
	Outline,
	Page,
	PasswordResponses,
	Thumbnail,
	pdfjs,
	useDocumentContext,
	useOutlineContext,
	usePageContext,
	type DocumentProps,
	type PageProps,
} from '@octanejs/react-pdf';

const documentProps: DocumentProps = {
	file: { url: '/sample.pdf', httpHeaders: { Authorization: 'Bearer test' } },
	onLoadSuccess(document) {
		document.numPages satisfies number;
	},
};
const pageProps: PageProps = {
	pageNumber: 1,
	width: 720,
	renderAnnotationLayer: true,
	renderForms: true,
	renderTextLayer: true,
};

void documentProps;
void pageProps;
void Document;
void Page;
void Thumbnail;
void Outline;
void LinkService;
void PasswordResponses;
void pdfjs.GlobalWorkerOptions.workerSrc;
void useDocumentContext;
void useOutlineContext;
void usePageContext;

// Page owns its positioning and scaling styles; arbitrary host style overrides
// would break the PDF.js layer geometry.
// @ts-expect-error Page intentionally does not accept a style prop.
pageProps.style = { position: 'static' };
