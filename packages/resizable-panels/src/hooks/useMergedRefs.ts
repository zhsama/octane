import type { Ref } from '../types';
import { useStableCallback } from './useStableCallback';

type PossibleRef<Type> = Ref<Type> | undefined;

export function useMergedRefs<Type>(...refs: PossibleRef<Type>[]) {
	if (typeof (refs.at(-1) as PossibleRef<Type> | symbol) === 'symbol') {
		refs.pop();
	}

	return useStableCallback((value: Type | null) => {
		refs.forEach((ref) => {
			if (ref) {
				switch (typeof ref) {
					case 'function': {
						ref(value);
						break;
					}
					case 'object': {
						ref.current = value;
						break;
					}
				}
			}
		});
	});
}
