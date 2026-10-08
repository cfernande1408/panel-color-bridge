const COLOR_RE =
    /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\))$/i;

// Returns [r, g, b], or null if the string is not a valid colour.
export function parseColor(str) {
    if (typeof str !== 'string')
        return null;
    str = str.trim();
    if (!COLOR_RE.test(str))
        return null;

    if (str.startsWith('#')) {
        let h = str.slice(1);
        if (h.length === 3 || h.length === 4)
            h = h.split('').map(c => c + c).join('');
        if (h.length !== 6 && h.length !== 8)
            return null;
        return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    }

    const n = str.match(/[\d.]+/g).map(Number);
    if (n.slice(0, 3).some(v => v > 255))
        return null;
    return n.slice(0, 3).map(Math.round);
}

// true if the background is light and the text should be dark.
export function isLight([r, g, b]) {
    const lin = v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.179;
}

// Points just below the top edge of a window frame, where the title
// bar or header bar is. Spread out to avoid the title and buttons.
export function titleBarPoints({x, y, width, height}) {
    const dy = Math.min(4, Math.floor(height / 2));
    return [0.2, 0.35, 0.5, 0.65, 0.8]
        .map(f => [Math.round(x + width * f), y + dy]);
}

// The colour seen at least twice among the samples (the most frequent
// one, ties to the earliest), or null if they all differ, e.g. on a
// gradient or an image.
export function dominantColor(samples) {
    const counts = new Map();
    let best = null;
    let bestCount = 1;
    for (const rgb of samples) {
        if (!rgb)
            continue;
        const key = rgb.join(',');
        const n = (counts.get(key) ?? 0) + 1;
        counts.set(key, n);
        if (n > bestCount) {
            best = rgb;
            bestCount = n;
        }
    }
    return best;
}

// Drops the points that fall inside any of the given rectangles
// (windows stacked on top), so we never sample a window covering it.
export function uncoveredPoints(points, rects) {
    return points.filter(([px, py]) => !rects.some(({x, y, width, height}) =>
        px >= x && px < x + width && py >= y && py < y + height));
}
