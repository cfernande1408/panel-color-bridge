// Run with: node --test tests/*.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';

import {parseColor, isLight, titleBarPoints, dominantColor, uncoveredPoints}
    from '../gnome/panel-color@carlos/colorutil.js';

test('parseColor', () => {
    assert.deepEqual(parseColor('#1e1e1e'), [30, 30, 30]);
    assert.deepEqual(parseColor('#fff'), [255, 255, 255]);
    assert.deepEqual(parseColor('rgb(1, 2, 3)'), [1, 2, 3]);
    assert.equal(parseColor(''), null);
    assert.equal(parseColor(null), null);
    assert.equal(parseColor('rgb(300, 0, 0)'), null);
});

test('isLight', () => {
    assert.equal(isLight([235, 235, 237]), true);
    assert.equal(isLight([30, 30, 30]), false);
});

test('titleBarPoints stays inside the top of the frame', () => {
    const rect = {x: 100, y: 50, width: 1000, height: 600};
    const pts = titleBarPoints(rect);
    assert.equal(pts.length, 5);
    for (const [x, y] of pts) {
        assert.ok(x > rect.x && x < rect.x + rect.width);
        assert.equal(y, 54);
    }
});

test('titleBarPoints on a tiny window', () => {
    for (const [, y] of titleBarPoints({x: 0, y: 0, width: 10, height: 3}))
        assert.equal(y, 1);
});

test('dominantColor picks the repeated colour', () => {
    const bar = [36, 36, 36];
    assert.deepEqual(dominantColor([bar, [200, 0, 0], bar, bar, [255, 255, 255]]), bar);
});

test('dominantColor ignores failed samples', () => {
    const bar = [10, 20, 30];
    assert.deepEqual(dominantColor([null, bar, null, bar, null]), bar);
});

test('dominantColor gives up when every sample differs', () => {
    assert.equal(dominantColor([[1, 1, 1], [2, 2, 2], [3, 3, 3]]), null);
    assert.equal(dominantColor([null, null]), null);
    assert.equal(dominantColor([]), null);
});

test('uncoveredPoints drops points under windows on top', () => {
    const pts = [[10, 5], [50, 5], [90, 5]];
    const terminal = {x: 40, y: 0, width: 20, height: 100};
    assert.deepEqual(uncoveredPoints(pts, [terminal]), [[10, 5], [90, 5]]);
    assert.deepEqual(uncoveredPoints(pts, []), pts);
    // Edges: right and bottom edges are outside the rectangle
    assert.deepEqual(uncoveredPoints([[60, 5], [40, 5]], [terminal]), [[60, 5]]);
});
