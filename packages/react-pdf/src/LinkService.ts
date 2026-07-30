import type { PDFDocumentProxy } from 'pdfjs-dist';
import type {
	Dest,
	ExternalLinkRel,
	ExternalLinkTarget,
	ResolvedDest,
	ScrollPageIntoViewArgs,
} from './types';
import { invariant } from './utils';

const DEFAULT_LINK_REL = 'noopener noreferrer nofollow';

type PDFViewer = {
	currentPageNumber?: number;
	scrollPageIntoView: (args: ScrollPageIntoViewArgs) => void;
};

export default class LinkService {
	externalLinkEnabled = true;
	externalLinkRel?: ExternalLinkRel;
	externalLinkTarget?: ExternalLinkTarget;
	isInPresentationMode = false;
	#navigationGeneration = 0;
	pdfDocument?: PDFDocumentProxy | null;
	pdfViewer?: PDFViewer | null;

	setDocument(pdfDocument: PDFDocumentProxy | null): void {
		if (this.pdfDocument === pdfDocument) return;
		this.#navigationGeneration += 1;
		this.pdfDocument = pdfDocument;
	}

	setViewer(pdfViewer: PDFViewer): void {
		this.pdfViewer = pdfViewer;
	}

	setExternalLinkRel(value?: ExternalLinkRel): void {
		this.externalLinkRel = value;
	}

	setExternalLinkTarget(value?: ExternalLinkTarget): void {
		this.externalLinkTarget = value;
	}

	setHash(): void {}
	setHistory(): void {}
	goToXY(): void {}
	cachePageRef(): void {}
	executeNamedAction(): void {}
	executeSetOCGState(): void {}
	isPageVisible(): boolean {
		return true;
	}
	isPageCached(): boolean {
		return true;
	}

	get pagesCount(): number {
		return this.pdfDocument?.numPages ?? 0;
	}

	get page(): number {
		invariant(this.pdfViewer, 'PDF viewer is not initialized.');
		return this.pdfViewer.currentPageNumber ?? 0;
	}

	set page(value: number) {
		invariant(this.pdfViewer, 'PDF viewer is not initialized.');
		this.pdfViewer.currentPageNumber = value;
	}

	get rotation(): number {
		return 0;
	}

	set rotation(_value: number) {}

	addLinkAttributes(link: HTMLAnchorElement, url: string, newWindow: boolean): void {
		link.href = url;
		link.rel = this.externalLinkRel || DEFAULT_LINK_REL;
		link.target = newWindow ? '_blank' : this.externalLinkTarget || '';
	}

	async goToDestination(dest: Dest): Promise<void> {
		const pdfDocument = this.pdfDocument;
		invariant(pdfDocument, 'PDF document not loaded.');
		invariant(dest, 'Destination is not specified.');
		const navigationGeneration = ++this.#navigationGeneration;
		const explicitDest: ResolvedDest | null =
			typeof dest === 'string'
				? await pdfDocument.getDestination(dest)
				: Array.isArray(dest)
					? dest
					: await dest;
		invariant(Array.isArray(explicitDest), `"${explicitDest}" is not a valid destination array.`);
		const destRef = explicitDest[0];
		const pageIndex =
			typeof destRef === 'number' ? destRef : await pdfDocument.getPageIndex(destRef);
		if (navigationGeneration !== this.#navigationGeneration || pdfDocument !== this.pdfDocument) {
			return;
		}
		const pageNumber = pageIndex + 1;
		invariant(this.pdfViewer, 'PDF viewer is not initialized.');
		invariant(
			pageNumber >= 1 && pageNumber <= this.pagesCount,
			`"${pageNumber}" is not a valid page number.`,
		);
		this.pdfViewer.scrollPageIntoView({ dest: explicitDest, pageIndex, pageNumber });
	}

	goToPage(pageNumber: number): void {
		this.#navigationGeneration += 1;
		invariant(this.pdfViewer, 'PDF viewer is not initialized.');
		invariant(
			pageNumber >= 1 && pageNumber <= this.pagesCount,
			`"${pageNumber}" is not a valid page number.`,
		);
		this.pdfViewer.scrollPageIntoView({ pageIndex: pageNumber - 1, pageNumber });
	}

	navigateTo(dest: Dest): void {
		void this.goToDestination(dest);
	}

	getDestinationHash(): string {
		return '#';
	}

	getAnchorUrl(): string {
		return '#';
	}
}
