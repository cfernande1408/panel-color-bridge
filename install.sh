#!/bin/bash
# Instala el host nativo y la extensión de GNOME.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
UUID=panel-color@carlos
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "== Host nativo =="
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

echo "== Extensión de GNOME =="
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
    echo "  Se ha conservado tu colors.json"
fi
echo "  $EXT_DIR"

echo
echo "Listo. Cierra sesión y vuelve a entrar, y luego:"
echo "  gnome-extensions enable $UUID"
