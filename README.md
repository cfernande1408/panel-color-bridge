# Panel Color Bridge

Makes the GNOME top panel match the active window, like the status bar
on Android:

- **Firefox**: follows the tab bar colour in real time (works with
  [Adaptive Tab Bar Colour](https://addons.mozilla.org/firefox/addon/adaptive-tab-bar-colour/)
  or any theme).
- **Other apps**: fixed colours per app, stored in GSettings.
- **No active window**: the panel goes back to its stock style, so it
  works alongside Blur my Shell.

Tested on Fedora 44 with GNOME 50.

## How it works

Reading pixels from the screen is slow and causes stutter, so Firefox
reports its colour directly instead:

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

Settings live in GSettings and apply immediately, no reload needed:

    S="--schemadir $HOME/.local/share/gnome-shell/extensions/panel-color@carlos/schemas"
    gsettings $S set org.gnome.shell.extensions.panel-color app-colors \
      "{'org.gnome.Ptyxis': '#1e1e1e', 'org.gnome.Nautilus': '#ebebed'}"
    gsettings $S set org.gnome.shell.extensions.panel-color default-color ''
    gsettings $S set org.gnome.shell.extensions.panel-color opacity 1.0

An empty `default-color` keeps the stock panel for apps not in the list.

To find an app's name, focus it and run:

    cat $XDG_RUNTIME_DIR/panel-color-focused

If you had a `colors.json` from an older version, `install.sh` moves
it to GSettings for you.

## License

GPL-2.0-or-later
