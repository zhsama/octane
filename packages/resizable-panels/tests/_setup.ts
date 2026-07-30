import { afterEach, vi } from 'vitest';

const observers = new Set<ResizeObserverMock>();
let panelWidth = 296;

function rectFor(element: Element): DOMRect {
	if (element.hasAttribute('data-group')) {
		return new DOMRect(0, 0, panelWidth * 2 + 8, 240);
	}
	if (element.hasAttribute('data-separator')) {
		return new DOMRect(panelWidth, 0, 8, 240);
	}
	if (element.id.endsWith('right') || element.id.endsWith('second')) {
		return new DOMRect(panelWidth + 8, 0, panelWidth, 240);
	}
	if (element.hasAttribute('data-panel')) {
		return new DOMRect(0, 0, panelWidth, 240);
	}
	return new DOMRect(0, 0, 0, 0);
}

function entryFor(element: Element): ResizeObserverEntry {
	const contentRect = rectFor(element);
	return {
		borderBoxSize: [
			{
				blockSize: contentRect.height,
				inlineSize: contentRect.width,
			},
		],
		contentBoxSize: [],
		contentRect,
		devicePixelContentBoxSize: [],
		target: element,
	};
}

class ResizeObserverMock implements ResizeObserver {
	readonly callback: ResizeObserverCallback;
	readonly elements = new Set<Element>();

	constructor(callback: ResizeObserverCallback) {
		this.callback = callback;
		observers.add(this);
	}

	observe(element: Element): void {
		this.elements.add(element);
		this.callback([entryFor(element)], this);
	}

	unobserve(element: Element): void {
		this.elements.delete(element);
	}

	disconnect(): void {
		this.elements.clear();
		observers.delete(this);
	}
}

export function observedElementIds(): string[] {
	return Array.from(observers)
		.flatMap((observer) => Array.from(observer.elements))
		.map((element) => element.id)
		.sort();
}

export function notifyResize(element: Element): void {
	for (const observer of observers) {
		if (observer.elements.has(element)) {
			observer.callback([entryFor(element)], observer);
		}
	}
}

export function setTestPanelWidth(value: number): void {
	panelWidth = value;
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);
vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
	callback(performance.now());
	return 1;
});
vi.stubGlobal('cancelAnimationFrame', () => {});

if (!window.matchMedia) {
	window.matchMedia = (query: string) =>
		({
			matches: false,
			media: query,
			onchange: null,
			addListener() {},
			removeListener() {},
			addEventListener() {},
			removeEventListener() {},
			dispatchEvent: () => false,
		}) as MediaQueryList;
}

HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
	return rectFor(this);
};

for (const property of ['clientHeight', 'offsetHeight'] as const) {
	Object.defineProperty(HTMLElement.prototype, property, {
		configurable: true,
		get() {
			return rectFor(this).height;
		},
	});
}
for (const property of ['clientWidth', 'offsetWidth'] as const) {
	Object.defineProperty(HTMLElement.prototype, property, {
		configurable: true,
		get() {
			return rectFor(this).width;
		},
	});
}
Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
	configurable: true,
	get() {
		return rectFor(this).left;
	},
});
Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
	configurable: true,
	get() {
		return rectFor(this).top;
	},
});

Object.defineProperty(HTMLElement.prototype, 'ariaDisabled', {
	configurable: true,
	get() {
		return this.getAttribute('aria-disabled');
	},
	set(value: string | null) {
		if (value === null) {
			this.removeAttribute('aria-disabled');
		} else {
			this.setAttribute('aria-disabled', value);
		}
	},
});

afterEach(() => {
	document.body.replaceChildren();
	observers.clear();
	panelWidth = 296;
});
