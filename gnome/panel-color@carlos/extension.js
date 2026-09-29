import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {parseColor, isLight} from './colorutil.js';

export default class PanelColorExtension extends Extension {
    enable() {
        this._colors = this._loadColors();
        const op = Number(this._colors.opacity);
        this._opacity = op >= 0 && op <= 1 ? op : 1;
        this._ffColor = null;
        this._inOverview = false;
        this._lastFocused = null;
        this._savedStyles = new Map();

        const runtime = GLib.get_user_runtime_dir();
        const dir = GLib.build_filenamev([runtime, 'panel-color-bridge']);
        GLib.mkdir_with_parents(dir, 0o700);
        this._colorFile = Gio.File.new_for_path(GLib.build_filenamev([dir, 'color']));
        this._focusedPath = GLib.build_filenamev([runtime, 'panel-color-focused']);

        this._monitor = Gio.File.new_for_path(dir)
            .monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
        this._monitorId = this._monitor.connect('changed', () => this._readBridge());

        this._focusId = global.display.connect('notify::focus-window',
            () => this._update());
        this._wsId = global.workspace_manager.connect('active-workspace-changed',
            () => this._update());
        this._ovShowId = Main.overview.connect('showing', () => {
            this._inOverview = true;
            this._update();
        });
        this._ovHideId = Main.overview.connect('hidden', () => {
            this._inOverview = false;
            this._update();
        });

        this._readBridge();
    }

    disable() {
        global.display.disconnect(this._focusId);
        global.workspace_manager.disconnect(this._wsId);
        Main.overview.disconnect(this._ovShowId);
        Main.overview.disconnect(this._ovHideId);
        this._monitor.disconnect(this._monitorId);
        this._monitor.cancel();
        this._monitor = null;
        this._colorFile = null;
        this._colors = null;
        this._reset();
        this._savedStyles = null;
    }

    _loadColors() {
        try {
            const path = GLib.build_filenamev([this.path, 'colors.json']);
            const [, bytes] = GLib.file_get_contents(path);
            return JSON.parse(new TextDecoder().decode(bytes));
        } catch (e) {
            console.warn(`panel-color: invalid colors.json: ${e.message}`);
            return {};
        }
    }

    _readBridge() {
        const file = this._colorFile;
        if (!file)
            return;
        file.load_contents_async(null, (f, res) => {
            if (!this._monitor)
                return; // disabled while reading
            let text = '';
            try {
                const [, bytes] = f.load_contents_finish(res);
                text = new TextDecoder().decode(bytes).trim();
            } catch {
                // Not created yet: Firefox has not sent anything
            }
            this._ffColor = text || null;
            this._update();
        });
    }

    _update() {
        if (this._inOverview) {
            this._reset();
            return;
        }

        const win = this._activeWindow();
        const cls = win ? (win.get_wm_class() ?? '') : '';
        this._writeFocused(cls);

        // No active window: restore the stock style (or Blur my Shell's)
        if (!win) {
            this._reset();
            return;
        }

        if (cls.toLowerCase().includes('firefox') && this._ffColor) {
            this._apply(this._ffColor);
            return;
        }

        for (const [key, value] of Object.entries(this._colors)) {
            if (key === 'default' || key === 'opacity')
                continue;
            if (key.toLowerCase() === cls.toLowerCase()) {
                this._apply(value);
                return;
            }
        }

        this._apply(this._colors.default);
    }

    _activeWindow() {
        const win = global.display.focus_window;
        if (!win || win.minimized)
            return null;
        const ws = global.workspace_manager.get_active_workspace();
        if (!win.is_on_all_workspaces() && win.get_workspace() !== ws)
            return null;
        return win;
    }

    // Writes the focused window class to a file, so you know
    // which name to use in colors.json.
    _writeFocused(cls) {
        if (cls === this._lastFocused)
            return;
        this._lastFocused = cls;
        try {
            GLib.file_set_contents(this._focusedPath, cls);
        } catch {}
    }

    _apply(color) {
        const rgb = parseColor(color);
        if (!rgb) {
            this._reset();
            return;
        }
        const light = isLight(rgb);

        this._setStyle(Main.panel,
            `background-color: rgba(${rgb.join(', ')}, ${this._opacity}); ` +
            'transition-duration: 200ms;');
        this._setLight(Main.panel, light);

        // Menus are always opaque, whatever the panel opacity is
        const bg = `rgb(${rgb.join(', ')})`;
        for (const menu of this._menus()) {
            this._setStyle(menu.box, `background-color: ${bg};`);
            this._setStyle(menu.actor, `-arrow-background-color: ${bg};`);
            menu.box.add_style_class_name('pcb-painted');
            this._setLight(menu.box, light);
        }
    }

    // Popup menus of every panel indicator (clock, quick settings,
    // other extensions). Scanned each time so late indicators are covered.
    _menus() {
        const menus = new Set();
        for (const indicator of Object.values(Main.panel.statusArea)) {
            const menu = indicator?.menu;
            if (menu?.box && menu.actor)
                menus.add(menu);
        }
        return menus;
    }

    _setStyle(actor, style) {
        if (!this._savedStyles.has(actor)) {
            // Forget actors destroyed while painted (e.g. another
            // extension removing its indicator)
            const destroyId = actor.connect('destroy',
                () => this._savedStyles.delete(actor));
            this._savedStyles.set(actor, {style: actor.get_style(), destroyId});
        }
        actor.set_style(style);
    }

    _setLight(actor, light) {
        if (light)
            actor.add_style_class_name('pcb-light');
        else
            actor.remove_style_class_name('pcb-light');
    }

    _reset() {
        for (const [actor, {style, destroyId}] of this._savedStyles) {
            actor.disconnect(destroyId);
            actor.set_style(style);
            actor.remove_style_class_name('pcb-light');
            actor.remove_style_class_name('pcb-painted');
        }
        this._savedStyles.clear();
    }
}
