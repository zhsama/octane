export const GlobalWorkerOptions = { workerSrc: 'pdf.worker.mjs', workerPort: null };
export const AnnotationMode = { DISABLE: 0, ENABLE: 1, ENABLE_FORMS: 2, ENABLE_STORAGE: 3 };
export const version = '5.4.296';

export class PDFDataRangeTransport {}

function browserOnly(): never {
	throw new Error('PDF.js rendering is browser-only; start PDF work after hydration.');
}

export class TextLayer {
	constructor(_parameters?: unknown) {
		browserOnly();
	}
}

export class AnnotationLayer {
	constructor(_parameters?: unknown) {
		browserOnly();
	}
}

export function getDocument(): never {
	return browserOnly();
}
