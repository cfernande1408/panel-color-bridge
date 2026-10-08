import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const NEW_APP_COLOR = '#303030';

function toHex(rgba) {
    const h = v => Math.round(v * 255).toString(16).padStart(2, '0');
    return `#${h(rgba.red)}${h(rgba.green)}${h(rgba.blue)}`;
}

function toRgba(str) {
    const rgba = new Gdk.RGBA();
    if (!str || !rgba.parse(str))
        rgba.parse(NEW_APP_COLOR);
    return rgba;
}

function colorButton(color, onChange) {
    const button = new Gtk.ColorDialogButton({
        dialog: new Gtk.ColorDialog({with_alpha: false}),
        rgba: toRgba(color),
        valign: Gtk.Align.CENTER,
    });
    button.connect('notify::rgba', () => onChange(toHex(button.rgba)));
    return button;
}

// Desktop file id without ".desktop", the name the extension matches on
function appId(info) {
    return info.get_id().replace(/\.desktop$/, '');
}

function appIcon(info) {
    return new Gtk.Image({
        gicon: info?.get_icon() ?? Gio.ThemedIcon.new('application-x-executable'),
        pixel_size: 32,
    });
}

function getApps(settings) {
    return settings.get_value('app-colors').deep_unpack();
}

function setApps(settings, apps) {
    settings.set_value('app-colors', new GLib.Variant('a{ss}', apps));
}

export default class PanelColorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        page.add(this._generalGroup(settings));
        page.add(this._appsGroup(settings, window));
        window.add(page);
    }

    _generalGroup(settings) {
        const group = new Adw.PreferencesGroup({title: 'General'});

        const opacity = Adw.SpinRow.new_with_range(0, 1, 0.05);
        opacity.set({
            title: 'Panel opacity',
            subtitle: 'Menus stay opaque',
            digits: 2,
        });
        settings.bind('opacity', opacity, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(opacity);

        // Empty default-color means "keep the stock panel"
        const current = settings.get_string('default-color');
        const other = new Adw.SwitchRow({
            title: 'Paint other apps',
            subtitle: 'Use one colour for apps not in the list',
            active: current !== '',
        });
        const button = colorButton(current, hex => {
            if (other.active)
                settings.set_string('default-color', hex);
        });
        other.bind_property('active', button, 'sensitive',
            GObject.BindingFlags.SYNC_CREATE);
        other.connect('notify::active', () => {
            settings.set_string('default-color',
                other.active ? toHex(button.rgba) : '');
        });
        other.add_suffix(button);
        group.add(other);

        return group;
    }

    _appsGroup(settings, window) {
        const group = new Adw.PreferencesGroup({
            title: 'Apps',
            description: 'The panel takes this colour while the app is focused. ' +
                'Firefox follows its tab bar instead when the Firefox add-on is installed.',
        });

        const add = new Gtk.Button({
            icon_name: 'list-add-symbolic',
            tooltip_text: 'Add App',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });
        add.connect('clicked', () => this._showAppPicker(settings, window));
        group.set_header_suffix(add);

        let rows = [];
        let shown = '';

        const rebuild = () => {
            const apps = getApps(settings);
            const ids = Object.keys(apps).sort();
            // Only colours changed: the rows are already right
            if (ids.join('\n') === shown && rows.length > 0)
                return;
            shown = ids.join('\n');

            rows.forEach(r => group.remove(r));
            rows = [];

            if (ids.length === 0) {
                rows.push(new Adw.ActionRow({
                    title: 'No apps yet',
                    subtitle: 'Add one with the + button',
                    sensitive: false,
                }));
            }

            const entries = ids.map(id => {
                const info = Gio.DesktopAppInfo.new(`${id}.desktop`);
                return {id, info, name: info?.get_display_name() ?? id};
            }).sort((a, b) => a.name.localeCompare(b.name));

            for (const {id, info, name} of entries) {
                const row = new Adw.ActionRow({title: name, subtitle: id});
                row.add_prefix(appIcon(info));
                row.add_suffix(colorButton(apps[id], hex => {
                    setApps(settings, {...getApps(settings), [id]: hex});
                }));
                const remove = new Gtk.Button({
                    icon_name: 'user-trash-symbolic',
                    tooltip_text: 'Remove',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat'],
                });
                remove.connect('clicked', () => {
                    const next = getApps(settings);
                    delete next[id];
                    setApps(settings, next);
                });
                row.add_suffix(remove);
                rows.push(row);
            }

            rows.forEach(r => group.add(r));
        };

        settings.connect('changed::app-colors', rebuild);
        rebuild();
        return group;
    }

    _showAppPicker(settings, parent) {
        const taken = new Set(Object.keys(getApps(settings)));
        const apps = Gio.AppInfo.get_all()
            .filter(a => a.should_show() && a.get_id() && !taken.has(appId(a)))
            .sort((a, b) => a.get_display_name().localeCompare(b.get_display_name()));

        const dialog = new Adw.Window({
            title: 'Add App',
            modal: true,
            transient_for: parent,
            default_width: 420,
            default_height: 560,
        });

        const search = new Gtk.SearchEntry({
            placeholder_text: 'Search apps',
            margin_start: 12,
            margin_end: 12,
            margin_top: 6,
            margin_bottom: 6,
        });

        const list = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
            margin_start: 12,
            margin_end: 12,
            margin_bottom: 12,
            valign: Gtk.Align.START,
        });
        for (const info of apps) {
            const row = new Adw.ActionRow({
                title: info.get_display_name(),
                subtitle: appId(info),
                activatable: true,
            });
            row.add_prefix(appIcon(info));
            row._appId = appId(info);
            list.append(row);
        }
        list.set_placeholder(new Gtk.Label({
            label: 'No apps found',
            css_classes: ['dim-label'],
            margin_top: 24,
            margin_bottom: 24,
        }));

        list.set_filter_func(row => {
            const q = search.text.trim().toLowerCase();
            return !q || `${row.title} ${row.subtitle}`.toLowerCase().includes(q);
        });
        search.connect('search-changed', () => list.invalidate_filter());

        const pick = row => {
            setApps(settings, {...getApps(settings), [row._appId]: NEW_APP_COLOR});
            dialog.close();
        };
        list.connect('row-activated', (_list, row) => pick(row));
        // Enter in the search box picks the first visible app
        search.connect('activate', () => {
            for (let r = list.get_first_child(); r; r = r.get_next_sibling()) {
                if (r instanceof Gtk.ListBoxRow && r.get_child_visible()) {
                    pick(r);
                    return;
                }
            }
        });

        const keys = new Gtk.EventControllerKey();
        keys.connect('key-pressed', (_c, keyval) => {
            if (keyval !== Gdk.KEY_Escape)
                return false;
            dialog.close();
            return true;
        });
        dialog.add_controller(keys);

        const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
        box.append(search);
        box.append(new Gtk.ScrolledWindow({
            child: list,
            vexpand: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
        }));

        const view = new Adw.ToolbarView({content: box});
        view.add_top_bar(new Adw.HeaderBar());
        dialog.set_content(view);
        dialog.present();
        search.grab_focus();
    }
}
