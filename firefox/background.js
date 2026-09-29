// Reads the tab bar colour (theme.colors.frame) of the focused window
// and sends it to the native host, which passes it on to GNOME.

const HOST = 'panel_color_bridge';
let port = null;
let last;
let timers = [];

function connect() {
  port = browser.runtime.connectNative(HOST);
  port.onDisconnect.addListener(() => {
    port = null;
    setTimeout(connect, 5000);
  });
  last = undefined;
  sendCurrent();
}

function toCss(c) {
  if (Array.isArray(c) && c.length >= 3) return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  if (typeof c === 'string') return c.trim();
  return null;
}

async function sendCurrent() {
  if (!port) return;
  try {
    const win = await browser.windows.getLastFocused();
    const theme = await browser.theme.getCurrent(win.id);
    const colors = (theme && theme.colors) || {};
    const color = toCss(colors.frame || colors.accentcolor) || '';
    if (color !== last) {
      last = color;
      port.postMessage({ color });
    }
  } catch (e) {
    console.error('panel-color-bridge:', e);
  }
}

// Adaptive Tab Bar Colour updates the theme shortly after a page loads,
// so check right away and once more a bit later.
function schedule() {
  timers.forEach(clearTimeout);
  timers = [setTimeout(sendCurrent, 50), setTimeout(sendCurrent, 400)];
}

browser.theme.onUpdated.addListener(schedule);
browser.windows.onFocusChanged.addListener((id) => {
  if (id !== browser.windows.WINDOW_ID_NONE) schedule();
});
browser.tabs.onActivated.addListener(schedule);
browser.tabs.onUpdated.addListener(schedule);

connect();
