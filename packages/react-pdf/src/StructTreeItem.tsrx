'use client';

import type { StructTreeContent, StructTreeNode } from 'pdfjs-dist/types/src/display/api.js';
import {
	getStructTreeAttributes,
	shouldRenderStructTreeChildren,
	structTreeKey,
} from './structTreeUtils';
import type { StructTreeNodeWithExtraAttributes } from './structTreeUtils';

export type StructTreeItemProps = {
	className?: string;
	node: StructTreeNodeWithExtraAttributes | StructTreeContent;
};

export default function StructTreeItem({ className, node }: StructTreeItemProps) @{
	const attributes = getStructTreeAttributes(node);
	const children: Array<StructTreeNode | StructTreeContent> = shouldRenderStructTreeChildren(node)
		? node.children
		: [];
	const keyedChildren = children.map(
		(child, index) => ({
			child,
			key: structTreeKey(child, index),
		}),
	);

	<span class={className} {...attributes}>
		@for (const entry of keyedChildren; key entry.key) {
			<StructTreeItem node={entry.child} />
		}
	</span>
}
