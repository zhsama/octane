export { flushEffects, mount } from '../../octane/tests/_helpers';
export { flushSync } from 'octane';

export async function settle(rounds = 6): Promise<void> {
	for (let index = 0; index < rounds; index++) {
		await Promise.resolve();
		const { flushSync } = await import('octane');
		const { flushEffects } = await import('../../octane/tests/_helpers');
		flushSync(() => {});
		flushEffects();
	}
}
