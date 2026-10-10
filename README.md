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

### Requirements

- GNOME Shell 45–50
- Firefox 142 or later, installed from your distribution's packages
  (the Flatpak and Snap builds are not supported yet: their sandbox
  does not see the native host)
- `git`, `python3` and `glib-compile-schemas` (package `glib2` on
  Fedora, `libglib2.0-bin` on Debian/Ubuntu)

### 1. GNOME extension and native host

    git clone https://github.com/cfernande1408/panel-color-bridge.git
    cd panel-color-bridge
    ./install.sh

This installs:

- the GNOME extension in
  `~/.local/share/gnome-shell/extensions/panel-color@carlos/`
- the native host in `~/.local/bin/panel-color-bridge.py`
- its Firefox manifest in `~/.mozilla/native-messaging-hosts/`

GNOME only loads new extensions at login, so log out and back in, then:

    gnome-extensions enable panel-color@carlos

At this point the panel already follows every app except Firefox.

### 2. Firefox extension

Download `panel-color-bridge.xpi` from the
[latest release](https://github.com/cfernande1408/panel-color-bridge/releases/latest)
and open it in Firefox (drag it onto a window, or
**about:addons → ⚙ → Install Add-on From File…**). Restart Firefox.

### Check that it works

Open a page in Firefox and run:

    cat "$XDG_RUNTIME_DIR/panel-color-bridge/color"

It should print the tab bar colour. If the file does not exist, Firefox
cannot reach the native host: run `./install.sh` again and restart
Firefox.

## Updating

    cd panel-color-bridge
    git pull
    ./install.sh

Then log out and back in. Your settings are kept. If the release has a
new `.xpi`, install it over the old one.

## Uninstalling

    gnome-extensions disable panel-color@carlos
    gsettings --schemadir ~/.local/share/gnome-shell/extensions/panel-color@carlos/schemas \
      reset-recursively org.gnome.shell.extensions.panel-color
    rm -rf ~/.local/share/gnome-shell/extensions/panel-color@carlos
    rm -f ~/.local/bin/panel-color-bridge.py
    rm -f ~/.mozilla/native-messaging-hosts/panel_color_bridge.json \
          ~/.config/mozilla/native-messaging-hosts/panel_color_bridge.json

Then remove **Panel Color Bridge** from `about:addons` in Firefox.

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

## Development

Run the tests with:

    node --test tests/*.test.mjs

Firefox only installs signed extensions. To build the `.xpi` for a
release, sign `firefox/` as an unlisted add-on with
[web-ext](https://github.com/mozilla/web-ext):

    cd firefox
    npx web-ext sign --channel=unlisted \
      --api-key=$WEB_EXT_API_KEY --api-secret=$WEB_EXT_API_SECRET

The signed file lands in `firefox/web-ext-artifacts/`. Attach it to a
GitHub release as `panel-color-bridge.xpi`.

## License

GPL-2.0-or-later
