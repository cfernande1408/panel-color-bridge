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
