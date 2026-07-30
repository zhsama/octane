'use client';

import { useEffect, useEffectEvent, useState } from 'octane';
import type { PDFPageProxy, StructTreeNode } from 'pdfjs-dist/types/src/display/api.js';
import { usePageContext } from './contexts.tsrx';
import StructTreeItem from './StructTreeItem.tsrx';
import { invariant, warn } from './utils';

type StructTreeState =
	| { page: PDFPageProxy; status: 'loading' }
	| { page: PDFPageProxy; status: 'loaded'; tree: StructTreeNode | null }
	| { page: PDFPageProxy; status: 'error'; error: Error };

export default function StructTree() {
	const context = usePageContext();
	invariant(context, 'Unable to find Page context.');
	const { customTextRenderer, onGetStructTreeError, onGetStructTreeSuccess, page } = context;
	const [state, setState] = useState<StructTreeState>({ page, status: 'loading' });
	const onSuccess = useEffectEvent((tree: StructTreeNode) => onGetStructTreeSuccess?.(tree));
	const onError = useEffectEvent((error: Error) => onGetStructTreeError?.(error));

	useEffect(() => {
		let active = true;
		setState({ page, status: 'loading' });
		if (customTextRenderer) {
			return () => {
				active = false;
			};
		}
		void page.getStructTree().then(
			(tree) => {
				if (!active) return;
				setState({ page, status: 'loaded', tree });
				if (tree) onSuccess(tree);
			},
			(reason) => {
				if (!active) return;
				const error =
					reason instanceof Error ? reason : new Error(String(reason));
				setState({ page, status: 'error', error });
				warn(error);
				onError(error);
			},
		);
		return () => {
			active = false;
		};
	}, [customTextRenderer, page]);

	const current =
		state.page === page ? state : { page, status: 'loading' } as const;
	if (customTextRenderer) return null;
	if (current.status !== 'loaded' || !current.tree) return null;
	return <StructTreeItem className="react-pdf__Page__structTree structTree" node={current.tree} />;
}
