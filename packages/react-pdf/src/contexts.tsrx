'use client';

import { createContext, useContext } from 'octane';
import type { DocumentContextType, OutlineContextType, PageContextType } from './types';

export const DocumentContext = createContext<DocumentContextType>(null);
export const PageContext = createContext<PageContextType>(null);
export const OutlineContext = createContext<OutlineContextType>(null);

export function useDocumentContext(): DocumentContextType {
	return useContext(DocumentContext);
}

export function usePageContext(): PageContextType {
	return useContext(PageContext);
}

export function useOutlineContext(): OutlineContextType {
	return useContext(OutlineContext);
}
