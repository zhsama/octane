import type { OctaneNode } from 'octane';
import type { Octane } from 'octane/jsx-runtime';
import type {
	PDFDataRangeTransport,
	PDFDocumentProxy,
	PDFPageProxy,
	PasswordResponses as PdfPasswordResponses,
} from 'pdfjs-dist';
import type { AnnotationLayerParameters } from 'pdfjs-dist/types/src/display/annotation_layer.js';
import type {
	DocumentInitParameters,
	RefProxy,
	StructTreeNode,
	TextContent,
	TextItem,
	TextMarkedContent,
	TypedArray,
} from 'pdfjs-dist/types/src/display/api.js';
import type LinkService from './LinkService';
import type PasswordResponses from './PasswordResponses';

export type {
	PdfPasswordResponses as PasswordResponses,
	StructTreeNode,
	TextContent,
	TextItem,
	TextMarkedContent,
};

export type ClassName = string | null | undefined | (string | null | undefined)[];
export type Annotations = AnnotationLayerParameters['annotations'];
export type ResolvedDest = (RefProxy | number)[];
export type Dest = Promise<ResolvedDest> | ResolvedDest | string | null;
export type ExternalLinkRel = string;
export type ExternalLinkTarget = '_self' | '_blank' | '_parent' | '_top';
export type ImageResourcesPath = string;
export type RenderMode = 'canvas' | 'custom' | 'none';
export type Ref<T> = ((value: T | null) => void) | { current: T | null } | null;
export type HostProps<T extends HTMLElement> = Omit<
	Octane.HTMLAttributes<T>,
	'children' | 'class' | 'className' | 'ref'
>;

export type ScrollPageIntoViewArgs = {
	dest?: ResolvedDest;
	pageIndex?: number;
	pageNumber: number;
};

export type OnItemClickArgs = {
	dest?: Dest;
	pageIndex: number;
	pageNumber: number;
};

export type OnLoadProgressArgs = {
	loaded: number;
	total: number;
};

export type BinaryData = TypedArray | ArrayBuffer | number[] | string;
export type Source = DocumentInitParameters & {
	data?: BinaryData;
	range?: PDFDataRangeTransport;
	url?: string | URL;
};
export type File =
	string | URL | ArrayBuffer | TypedArray | Blob | PDFDataRangeTransport | Source | null;
export type Options = Omit<DocumentInitParameters, 'data' | 'range' | 'url'>;
export type NodeOrRenderer = OctaneNode | (() => OctaneNode);
export type PageColors = { background: string; foreground: string };
export type FilterAnnotations = (args: { annotations: Annotations }) => Annotations;
export type CustomTextRenderer = (
	props: { pageIndex: number; pageNumber: number; itemIndex: number } & TextItem,
) => string;
export type CustomRenderer = () => OctaneNode;
export type PasswordResponse = (typeof PasswordResponses)[keyof typeof PasswordResponses];
export type OnPasswordCallback = (password: string | null) => void;

export type PageCallback = PDFPageProxy & {
	readonly width: number;
	readonly height: number;
	readonly originalWidth: number;
	readonly originalHeight: number;
};

export type RegisterPage = (pageIndex: number, ref: HTMLDivElement) => void;
export type UnregisterPage = (pageIndex: number) => void;

export type DocumentContextType = {
	imageResourcesPath?: ImageResourcesPath;
	linkService: LinkService;
	onItemClick?: (args: OnItemClickArgs) => void;
	pdf?: PDFDocumentProxy | false;
	registerPage: RegisterPage;
	renderMode?: RenderMode;
	rotate?: number | null;
	scale?: number;
	unregisterPage: UnregisterPage;
} | null;

export type PageContextType = {
	_className?: string;
	canvasBackground?: string;
	customTextRenderer?: CustomTextRenderer;
	devicePixelRatio?: number;
	filterAnnotations?: FilterAnnotations;
	imageResourcesPath?: ImageResourcesPath;
	linkService: LinkService;
	onGetAnnotationsError?: (error: Error) => void;
	onGetAnnotationsSuccess?: (annotations: Annotations) => void;
	onGetStructTreeError?: (error: Error) => void;
	onGetStructTreeSuccess?: (tree: StructTreeNode) => void;
	onGetTextError?: (error: Error) => void;
	onGetTextSuccess?: (text: TextContent) => void;
	onRenderAnnotationLayerError?: (error: unknown) => void;
	onRenderAnnotationLayerSuccess?: () => void;
	onRenderError?: (error: Error) => void;
	onRenderSuccess?: (page: PageCallback) => void;
	onRenderTextLayerError?: (error: Error) => void;
	onRenderTextLayerSuccess?: () => void;
	page: PDFPageProxy;
	pageColors?: PageColors;
	pageIndex: number;
	pageNumber: number;
	pdf: PDFDocumentProxy;
	renderForms: boolean;
	renderTextLayer: boolean;
	rotate: number;
	scale: number;
} | null;

export type OutlineContextType = {
	onItemClick?: (args: OnItemClickArgs) => void;
} | null;

export type DocumentRenderProps = Omit<NonNullable<DocumentContextType>, 'pdf'> & {
	pdf: PDFDocumentProxy;
};

export type PageRenderProps = Omit<NonNullable<PageContextType>, 'page'> & {
	page: PDFPageProxy;
};

export type DocumentHandle = {
	linkService: { current: LinkService };
	pages: { current: HTMLDivElement[] };
	viewer: {
		current: {
			scrollPageIntoView: (args: ScrollPageIntoViewArgs) => void;
		};
	};
};
