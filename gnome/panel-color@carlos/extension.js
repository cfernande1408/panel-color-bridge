import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {parseColor, isLight, titleBarPoints, dominantColor} from './colorutil.js';

// Wait for the focus/map animation to finish before reading pixels
const DETECT_DELAY_MS = 200;

export default class PanelColorExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._loadSettings();
        this._settingsId = this._settings.connect('changed', () => {
            this._loadSettings();
            this._update();
        });
        this._ffColor = null;
        this._inOverview = false;
        this._savedStyles = new Map();
        this._detected = new WeakMap(); // window -> last detected colour
        this._detectId = 0;
        this._detectGen = 0;

        const runtime = GLib.get_user_runtime_dir();
        const dir = GLib.build_filenamev([runtime, 'panel-color-bridge']);
        GLib.mkdir_with_parents(dir, 0o700);
        this._colorFile = Gio.File.new_for_path(GLib.build_filenamev([dir, 'color']));

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
        this._cancelDetect();
        this._detected = null;
        this._settings.disconnect(this._settingsId);
        this._settings = null;
        global.display.disconnect(this._focusId);
        global.workspace_manager.disconnect(this._wsId);
        Main.overview.disconnect(this._ovShowId);
        Main.overview.disconnect(this._ovHideId);
        this._monitor.disconnect(this._monitorId);
        this._monitor.cancel();
        this._monitor = null;
        this._colorFile = null;
        this._appColors = null;
        this._reset();
        this._savedStyles = null;
    }

    _loadSettings() {
        this._opacity = this._settings.get_double('opacity');
        this._defaultColor = this._settings.get_string('default-color');
        this._autoDetect = this._settings.get_boolean('auto-detect');
        // Lower-case keys so matching ignores case
        const map = this._settings.get_value('app-colors').deep_unpack();
        this._appColors = new Map(
            Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]));
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
        this._cancelDetect();

        if (this._inOverview) {
            this._reset();
            return;
        }

        const win = this._activeWindow();

        // No active window: restore the stock style (or Blur my Shell's)
        if (!win) {
            this._reset();
            return;
        }

        const names = this._windowNames(win);
        if (this._ffColor && names.some(n => n.includes('firefox'))) {
            this._apply(this._ffColor);
            return;
        }

        const match = names.find(n => this._appColors.has(n));
        if (match) {
            this._apply(this._appColors.get(match));
            return;
        }

        if (this._autoDetect) {
            this._detect(win);
            return;
        }

        this._apply(this._defaultColor);
    }

    // Shows the colour detected last time for this window right away,
    // then samples its title bar again once animations have settled.
    _detect(win) {
        const cached = this._detected.get(win);
        if (cached)
            this._apply(cached);

        const gen = this._detectGen;
        this._detectId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DETECT_DELAY_MS, () => {
            this._detectId = 0;
            this._sample(win, gen).catch(e =>
                console.warn(`panel-color: colour detection failed: ${e.message}`));
            return GLib.SOURCE_REMOVE;
        });
    }

    async _sample(win, gen) {
        const samples = [];
        for (const [x, y] of titleBarPoints(win.get_frame_rect()))
            samples.push(await this._pickColor(x, y));

        // Focus changed, settings changed or disabled while sampling
        if (gen !== this._detectGen || !this._detected)
            return;

        const rgb = dominantColor(samples);
        if (!rgb) {
            this._apply(this._defaultColor);
            return;
        }
        const color = `rgb(${rgb.join(', ')})`;
        this._detected.set(win, color);
        this._apply(color);
    }

    _pickColor(x, y) {
        return new Promise(resolve => {
            new Shell.Screenshot().pick_color(x, y, (shot, res) => {
                try {
                    // [ok, color] or [color] depending on the GJS version
                    const c = [shot.pick_color_finish(res)].flat()
                        .find(v => typeof v === 'object' && v && 'red' in v);
                    resolve(c ? [c.red, c.green, c.blue] : null);
                } catch {
                    resolve(null); // e.g. point off screen
                }
            });
        });
    }

    // Drops a pending detection and makes in-flight samples stale
    _cancelDetect() {
        if (this._detectId) {
            GLib.source_remove(this._detectId);
            this._detectId = 0;
        }
        this._detectGen++;
    }

    // Names a window can be matched by, lower-cased: its app id
    // (desktop file name, what the preferences store) and its class.
    _windowNames(win) {
        const names = [];
        const app = Shell.WindowTracker.get_default().get_window_app(win);
        const id = app?.get_id();
        if (id)
            names.push(id.replace(/\.desktop$/, '').toLowerCase());
        const cls = win.get_wm_class();
        if (cls)
            names.push(cls.toLowerCase());
        return names;
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
