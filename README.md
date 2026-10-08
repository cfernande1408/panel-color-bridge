# Panel Color Bridge

Makes the GNOME top panel match the active window, like the status bar
on Android:

- **Firefox**: follows the tab bar colour in real time (works with
  [Adaptive Tab Bar Colour](https://addons.mozilla.org/firefox/addon/adaptive-tab-bar-colour/)
  or any theme).
- **Other apps**: the colour of the window's title bar, detected when
  the window gets focus. You can set fixed colours for apps where
  detection gets it wrong.
- **No active window**: the panel goes back to its stock style, so it
  works alongside Blur my Shell.

Tested on Fedora 44 with GNOME 50.

## How it works

For most apps, the extension reads five pixels just below the top of
the focused window, once, 200 ms after it gets focus (so animations
have finished). The colour seen most often wins; if every pixel is
different (a gradient or an image), the fallback colour is used. It
never samples continuously, so it costs nothing while you work.
Points hidden by other windows are skipped, so a window on top is
never mistaken for the one underneath.

Firefox can change colour on every tab, which focus-time sampling
would miss, so it reports its colour directly instead:

1. `firefox/` — a Firefox extension listens for theme changes and sends
   the tab bar colour through native messaging.
2. `host/` — a small Python script receives the colour and writes it to
   `$XDG_RUNTIME_DIR/panel-color-bridge/color`.
3. `gnome/` — a GNOME Shell extension watches that file and the focused
   window, and paints the panel.

## Installation

    ./install.sh

Log out and back in, then:

    gnome-extensions enable panel-color@carlos

Firefox only installs signed extensions. Sign `firefox/` as an unlisted
add-on with [web-ext](https://github.com/mozilla/web-ext):

    cd firefox
    npx web-ext sign --channel=unlisted \
      --api-key=$WEB_EXT_API_KEY --api-secret=$WEB_EXT_API_SECRET

Then install the `.xpi` from `web-ext-artifacts/` in Firefox.

## Per-app colours

Open the preferences:

    gnome-extensions prefs panel-color@carlos

- **Detect colours automatically**: reads each window's title bar.
- **Only maximized windows**: follow the top window that touches the
  panel (maximized or tiled) instead of the focused one, so a floating
  window over a maximized browser leaves the panel alone. With nothing
  maximized, the panel keeps its stock style.
- **Fallback colour**: used when nothing is detected and the app has no
  fixed colour. When it is off, the panel keeps its stock style.
- **Fixed colours**: add apps with the **+** button to always use your
  colour instead of the detected one.

Changes apply immediately.

Apps are matched by their desktop file name (e.g. `org.gnome.Terminal`),
falling back to the window class.

If you had a `colors.json` from an older version, `install.sh` moves
it to GSettings for you.

## Tests

    node --test tests/*.test.mjs

## License

GPL-2.0-or-later
