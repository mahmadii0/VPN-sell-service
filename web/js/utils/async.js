const loadedScreens = new Set();
const versions = new WeakMap();

export function markScreenLoaded(id) {
    loadedScreens.add(id);
}

export function isScreenLoaded(id) {
    return loadedScreens.has(id);
}

export async function renderWithSkeleton(options) {
    const {
        screenId,
        container,
        skeleton,
        load,
        render,
        minDelay = 320
    } = options;

    if (!container) return;

    const version = (versions.get(container) || 0) + 1;
    versions.set(container, version);

    const firstLoad = !isScreenLoaded(screenId);

    container.replaceChildren();

    if (firstLoad && skeleton) {
        container.appendChild(skeleton);
    }

    try {
        const [data] = await Promise.all([
            load(),
            new Promise((resolve) => {
                setTimeout(resolve, firstLoad ? minDelay : 0);
            })
        ]);

        if (versions.get(container) !== version) return;

        container.replaceChildren(render(data));
        markScreenLoaded(screenId);
    } catch (err) {
        if (versions.get(container) !== version) return;

        console.error('[async] load error:', err);

        const box = document.createElement('div');
        box.className = 'pulse-empty';

        const message = document.createElement('p');
        message.textContent = err?.message || 'خطا در دریافت اطلاعات';

        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'pulse-btn pulse-btn--primary';
        retry.textContent = 'تلاش مجدد';

        retry.addEventListener('click', () => {
            renderWithSkeleton(options);
        });

        box.append(message, retry);
        container.replaceChildren(box);
    }
}
