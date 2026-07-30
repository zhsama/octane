import type { StructTreeContent, StructTreeNode } from 'pdfjs-dist/types/src/display/api.js';

const HEADING_PATTERN = /^H(\d+)$/;
const PDF_ROLE_TO_HTML_ROLE = {
	Document: null,
	DocumentFragment: null,
	Part: 'group',
	Sect: 'group',
	Div: 'group',
	Aside: 'note',
	NonStruct: 'none',
	P: null,
	H: 'heading',
	Title: null,
	FENote: 'note',
	Sub: 'group',
	Lbl: null,
	Span: null,
	Em: null,
	Strong: null,
	Link: 'link',
	Annot: 'note',
	Form: 'form',
	Ruby: null,
	RB: null,
	RT: null,
	RP: null,
	Warichu: null,
	WT: null,
	WP: null,
	L: 'list',
	LI: 'listitem',
	LBody: null,
	Table: 'table',
	TR: 'row',
	TH: 'columnheader',
	TD: 'cell',
	THead: 'columnheader',
	TBody: null,
	TFoot: null,
	Caption: null,
	Figure: 'figure',
	Formula: null,
	Artifact: null,
} as const;

export type StructTreeNodeWithExtraAttributes = StructTreeNode & {
	alt?: string;
	lang?: string;
};

export type StructTreeAttributes = {
	'aria-label'?: string;
	'aria-level'?: number;
	'aria-owns'?: string;
	lang?: string;
	role?: string;
};

export function isStructTreeNode(node: StructTreeNode | StructTreeContent): node is StructTreeNode {
	return 'children' in node;
}

function hasOnlyContentChild(node: StructTreeNode | StructTreeContent): boolean {
	return (
		isStructTreeNode(node) &&
		node.children.length === 1 &&
		node.children[0] !== undefined &&
		'id' in node.children[0]
	);
}

export function getStructTreeAttributes(
	node: StructTreeNodeWithExtraAttributes | StructTreeContent,
): StructTreeAttributes {
	const attributes: StructTreeAttributes = {};
	if (!isStructTreeNode(node)) {
		attributes['aria-owns'] = node.id;
		return attributes;
	}

	const heading = node.role.match(HEADING_PATTERN);
	if (heading) {
		attributes.role = 'heading';
		attributes['aria-level'] = Number(heading[1]);
	} else if (node.role in PDF_ROLE_TO_HTML_ROLE) {
		const role = PDF_ROLE_TO_HTML_ROLE[node.role as keyof typeof PDF_ROLE_TO_HTML_ROLE];
		if (role) attributes.role = role;
	}
	if (node.alt !== undefined) attributes['aria-label'] = node.alt;
	if (node.lang !== undefined) attributes.lang = node.lang;
	if (hasOnlyContentChild(node)) {
		Object.assign(attributes, getStructTreeAttributes(node.children[0]));
	}
	return attributes;
}

export function structTreeKey(node: StructTreeNode | StructTreeContent, index: number): string {
	return 'id' in node ? `content:${node.id}` : `node:${index}:${node.role}`;
}

export function shouldRenderStructTreeChildren(
	node: StructTreeNode | StructTreeContent,
): node is StructTreeNode {
	return isStructTreeNode(node) && !hasOnlyContentChild(node);
}
