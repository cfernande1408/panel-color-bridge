#!/bin/bash
# Installs the native host and the GNOME extension.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
UUID=panel-color@carlos
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "== Native host =="
mkdir -p "$HOME/.local/bin"
install -m 755 "$DIR/host/panel-color-bridge.py" "$HOME/.local/bin/panel-color-bridge.py"

hosts=("$HOME/.mozilla/native-messaging-hosts")
[ -d "$HOME/.config/mozilla" ] && hosts+=("$HOME/.config/mozilla/native-messaging-hosts")
for d in "${hosts[@]}"; do
    mkdir -p "$d"
    sed "s|@PATH@|$HOME/.local/bin/panel-color-bridge.py|" \
        "$DIR/host/panel_color_bridge.json" > "$d/panel_color_bridge.json"
    echo "  $d/panel_color_bridge.json"
done

echo "== GNOME extension =="
backup=""
if [ -f "$EXT_DIR/colors.json" ]; then
    backup=$(mktemp)
    cp "$EXT_DIR/colors.json" "$backup"
fi
rm -rf "$EXT_DIR"
mkdir -p "$EXT_DIR"
cp -r "$DIR/gnome/$UUID/." "$EXT_DIR/"
if [ -n "$backup" ]; then
    cp "$backup" "$EXT_DIR/colors.json"
    rm -f "$backup"
    echo "  Kept your existing colors.json"
fi
echo "  $EXT_DIR"

echo
echo "Done. Log out and back in, then run:"
echo "  gnome-extensions enable $UUID"
