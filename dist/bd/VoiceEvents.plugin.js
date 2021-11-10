/**
 * @name VoiceEvents
 * @author Zerthox
 * @version 2.0.0
 * @description Add TTS Event Notifications to your selected Voice Channel. TeamSpeak feeling.
 * @authorLink https://github.com/Zerthox
 * @website https://github.com/Zerthox/BetterDiscord-Plugins
 * @source https://github.com/Zerthox/BetterDiscord-Plugins/tree/master/src/VoiceEvents
 * @updateUrl https://github.com/Zerthox/BetterDiscord-Plugins/blob/master/dist/bd/VoiceEvents.plugin.js
**/

/*@cc_on @if (@_jscript)
var pluginName = WScript.ScriptName.split(".")[0];
var shell = WScript.CreateObject("WScript.Shell");
shell.Popup(
    "Do NOT run scripts from the internet with the Windows Script Host!\nMove this file to your BetterDiscord plugins folder.",
    0,
    pluginName + ": Warning!",
    0x1030
);
var fso = new ActiveXObject("Scripting.FileSystemObject");
var pluginsPath = shell.expandEnvironmentStrings("%appdata%\\BetterDiscord\\plugins");
if (!fso.FolderExists(pluginsPath)) {
    var popup = shell.Popup(
        "Unable to find BetterDiscord on your computer.\nOpen the download page of BetterDiscord?",
        0,
        pluginName + ": BetterDiscord not found",
        0x34
    );
    if (popup === 6) {
        shell.Exec("explorer \"https://betterdiscord.app\"");
    }
} else if (WScript.ScriptFullName === pluginsPath + "\\" + WScript.ScriptName) {
    shell.Popup(
        "This plugin is already in the correct folder.\nNavigate to the \"Plugins\" settings tab in Discord and enable it there.",
        0,
        pluginName,
        0x40
    );
} else {
    var popup = shell.Popup(
        "Open the BetterDiscord plugins folder?",
        0,
        pluginName,
        0x34
    );
    if (popup === 6) {
        shell.Exec("explorer " + pluginsPath);
    }
}
WScript.Quit();
@else @*/

'use strict';

const createLogger = (name, color, version) => {
    const print = (output, ...data) => output(`%c[${name}] %c${version ? `(v${version})` : ""}`, `color: ${color}; font-weight: 700;`, "color: #666; font-size: .8em;", ...data);
    return {
        print,
        log: (...data) => print(console.log, ...data),
        warn: (...data) => print(console.warn, ...data),
        error: (...data) => print(console.error, ...data)
    };
};

const createPatcher = (id, Logger) => {
    const forward = (patcher, object, method, callback, options) => {
        const original = object[method];
        const cancel = patcher(id, object, method, (context, args, result) => {
            const temp = callback({ cancel, original, context, args, result });
            if (options.once) {
                cancel();
            }
            return temp;
        }, { silent: true });
        if (!options.silent) {
            const target = method === "default" ? object[method] : {};
            const name = options.name ?? object.displayName ?? object.constructor?.displayName ?? target.displayName ?? "unknown";
            Logger.log(`Patched ${method} of ${name}`);
        }
        return cancel;
    };
    const { Patcher } = BdApi;
    return {
        instead: (object, method, callback, options = {}) => forward(Patcher.instead, object, method, ({ result: _, ...data }) => callback(data), options),
        before: (object, method, callback, options = {}) => forward(Patcher.before, object, method, ({ result: _, ...data }) => callback(data), options),
        after: (object, method, callback, options = {}) => forward(Patcher.after, object, method, callback, options),
        unpatchAll: () => {
            Patcher.unpatchAll(id);
            Logger.log("Unpatched all");
        }
    };
};

const createStyles = (id) => {
    return {
        inject(styles) {
            if (typeof styles === "string") {
                BdApi.injectCSS(id, styles);
            }
        },
        clear: () => BdApi.clearCSS(id)
    };
};

const createData = (id) => ({
    load: (key) => BdApi.loadData(id, key) ?? null,
    save: (key, value) => BdApi.saveData(id, key, value),
    delete: (key) => BdApi.deleteData(id, key)
});

let webpackRequire;
global.webpackJsonp.push([
    [],
    {
        __discordium__: (_module, _exports, require) => {
            webpackRequire = require;
        }
    },
    [["__discordium__"]]
]);
delete webpackRequire.m.__discordium__;
delete webpackRequire.c.__discordium__;
const applyFilters = (filters) => {
    return (module) => {
        const { exports } = module;
        return filters.every((filter) => filter(exports, module) || (exports?.__esModule && filter(exports?.default, module)));
    };
};
const filters = {
    byExports(exported) {
        return (target) => target === exported || (target instanceof Object && Object.values(target).includes(exported));
    },
    byName(name) {
        return (target) => target instanceof Object && Object.values(target).some(filters.byDisplayName(name));
    },
    byDisplayName(name) {
        return (target) => target?.displayName === name || target?.constructor?.displayName === name;
    },
    byProps(props) {
        return (target) => target instanceof Object && props.every((prop) => prop in target);
    },
    byProtos(protos) {
        return (target) => target instanceof Object && target.prototype instanceof Object && protos.every((proto) => proto in target.prototype);
    },
    bySource(contents) {
        return (target) => target instanceof Function && contents.every((content) => target.toString().includes(content));
    }
};
const genFilters = ({ filter, name, props, protos, source }) => [
    ...[filter].flat(),
    typeof name === "string" ? filters.byName(name) : null,
    props instanceof Array ? filters.byProps(props) : null,
    protos instanceof Array ? filters.byProtos(protos) : null,
    source instanceof Array ? filters.bySource(source) : null
].filter((entry) => entry instanceof Function);
const raw = {
    require: webpackRequire,
    getAll: () => Object.values(webpackRequire.c),
    find: (...filters) => raw.getAll().find(applyFilters(filters)) ?? null,
    query: (options) => raw.find(...genFilters(options)),
    byId: (id) => webpackRequire.c[id] ?? null,
    byExports: (exported) => raw.find(filters.byExports(exported)),
    byName: (name) => raw.find(filters.byName(name)),
    byProps: (...props) => raw.find(filters.byProps(props)),
    byProtos: (...protos) => raw.find(filters.byProtos(protos)),
    bySource: (...contents) => raw.find(filters.bySource(contents)),
    all: {
        find: (...filters) => raw.getAll().filter(applyFilters(filters)),
        query: (options) => raw.all.find(...genFilters(options)),
        byExports: (exported) => raw.all.find(filters.byExports(exported)),
        byName: (name) => raw.all.find(filters.byName(name)),
        byProps: (...props) => raw.all.find(filters.byProps(props)),
        byProtos: (...protos) => raw.all.find(filters.byProtos(protos)),
        bySource: (...contents) => raw.all.find(filters.bySource(contents))
    },
    resolveExports: (module, filter = null) => {
        if (module instanceof Object && "exports" in module) {
            const exported = module.exports;
            if (!exported) {
                return exported;
            }
            if (typeof filter === "string") {
                return exported[filter];
            }
            else if (filter instanceof Function) {
                const result = Object.values(exported).find((value) => filter(value));
                if (result !== undefined) {
                    return result;
                }
            }
            if (exported instanceof Object && exported.__esModule && "default" in exported && Object.keys(exported).length === 1) {
                return exported.default;
            }
            return exported;
        }
        return null;
    }
};
const Finder = {
    raw,
    getAll: () => raw.getAll().map((entry) => raw.resolveExports(entry)),
    find: (...filters) => raw.resolveExports(raw.find(...filters)),
    query: (options) => raw.resolveExports(raw.query(options), options.export),
    byId: (id) => raw.resolveExports(raw.byId(id)),
    byExports: (exported) => raw.resolveExports(raw.byExports(exported)),
    byName: (name) => raw.resolveExports(raw.byName(name), filters.byDisplayName(name)),
    byProps: (...props) => raw.resolveExports(raw.byProps(...props), filters.byProps(props)),
    byProtos: (...protos) => raw.resolveExports(raw.byProtos(...protos), filters.byProtos(protos)),
    bySource: (...contents) => raw.resolveExports(raw.bySource(...contents), filters.bySource(contents)),
    all: {
        find: (...filters) => raw.all.find(...filters).map((entry) => raw.resolveExports(entry)),
        query: (options) => raw.all.query(options).map((entry) => raw.resolveExports(entry, options.export)),
        byExports: (exported) => raw.all.byExports(exported).map((entry) => raw.resolveExports(entry)),
        byName: (name) => raw.all.byName(name).map((entry) => raw.resolveExports(entry, filters.byDisplayName(name))),
        byProps: (...props) => raw.all.byProps(...props).map((entry) => raw.resolveExports(entry, filters.byProps(props))),
        byProtos: (...protos) => raw.all.byProtos(...protos).map((entry) => raw.resolveExports(entry, filters.byProtos(protos))),
        bySource: (...contents) => raw.all.bySource(...contents).map((entry) => raw.resolveExports(entry, filters.bySource(contents)))
    }
};

Finder.byProps("subscribe", "emit");
const React = Finder.byProps("createElement", "Component", "Fragment");
const ReactDOM = Finder.byProps("render", "findDOMNode", "createPortal");
const classNames = Finder.find((exports) => exports instanceof Object && exports.default === exports && Object.keys(exports).length === 1);
Finder.byProps("cloneDeep", "flattenDeep");
Finder.byProps("valid", "satifies");
Finder.byProps("utc", "months");
Finder.byProps("parseBlock", "parseInline");
Finder.byProps("highlight", "highlightBlock");
Finder.byProps("captureBreadcrumb");
Finder.byProps("assert", "validate", "object");
const Flux = Finder.query({ props: ["Store", "connectStores"], export: "default" });
const Dispatcher = Finder.query({ props: ["Dispatcher"], export: "Dispatcher" });
Finder.byProps("languages", "getLocale");

class Settings extends Flux.Store {
    constructor(Data, defaults) {
        super(new Dispatcher(), {
            update: ({ current }) => Data.save("settings", current)
        });
        this.listeners = new Set();
        this.defaults = defaults;
        this.current = Data.load("settings") ?? { ...defaults };
    }
    get() {
        return { ...this.current };
    }
    set(settings) {
        Object.assign(this.current, settings instanceof Function ? settings(this.get()) : settings);
        this._dispatcher.dispatch({ type: "update", current: this.current });
    }
    reset() {
        this.set({ ...this.defaults });
    }
    connect(component) {
        return Flux.connectStores([this], () => ({ ...this.get(), set: this.set, defaults: this.defaults }))(component);
    }
    addListener(listener) {
        this.listeners.add(listener);
        this._dispatcher.subscribe("update", listener);
        return listener;
    }
    removeListener(listener) {
        if (this.listeners.has(listener)) {
            this._dispatcher.unsubscribe("update", listener);
            this.listeners.delete(listener);
        }
    }
    removeAllListeners() {
        for (const listener of this.listeners) {
            this._dispatcher.unsubscribe("update", listener);
        }
        this.listeners.clear();
    }
}
const createSettings = (Data, defaults) => new Settings(Data, defaults);

React?.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
ReactDOM?.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.Events;

const alert = (title, content) => BdApi.alert(title, content);

const createPlugin = ({ name, version, styles: css, settings }, callback) => {
    const Logger = createLogger(name, "#3a71c1", version);
    const Patcher = createPatcher(name, Logger);
    const Styles = createStyles(name);
    const Data = createData(name);
    const Settings = createSettings(Data, settings ?? {});
    const plugin = callback({ Logger, Patcher, Styles, Data, Settings });
    function Wrapper() { }
    Wrapper.prototype.start = () => {
        Logger.log("Enabled");
        Styles.inject(css);
        plugin.start();
    };
    Wrapper.prototype.stop = () => {
        Patcher.unpatchAll();
        Styles.clear();
        const promise = plugin.stop();
        if (promise) {
            promise.then(() => Logger.log("Disabled"));
        }
        else {
            Logger.log("Disabled");
        }
    };
    if (plugin.settingsPanel) {
        const ConnectedSettings = Settings.connect(plugin.settingsPanel);
        Wrapper.prototype.getSettingsPanel = () => React.createElement(ConnectedSettings, null);
    }
    return Wrapper;
};

const Flex = Finder.byName("Flex");
const Text$1 = Finder.byName("Text");
const Button = Finder.byProps("Link", "Hovers");
const { FormSection, FormTitle, FormItem, FormText, FormDivider } = Finder.byProps("FormSection", "FormText") ?? {};
const SwitchItem = Finder.byName("SwitchItem");
const TextInput = Finder.byName("TextInput");
const SelectTempWrapper = Finder.byName("SelectTempWrapper");
const Slider = Finder.byName("Slider");
const margins = Finder.byProps("marginLarge");
const settings = {
    voice: null,
    volume: 100,
    speed: 1,
    filterNames: true,
    filterBots: false,
    filterStages: true,
    join: "$user joined $channel",
    leave: "$user left $channel",
    joinSelf: "You joined $channel",
    moveSelf: "You were moved to $channel",
    leaveSelf: "You left $channel",
    privateCall: "The call"
};
const SettingsPanel = ({ speak, defaults, set, voice, volume, speed, filterNames, filterBots, filterStages, ...settings }) => (React.createElement(React.Fragment, null,
    React.createElement(FormItem, { className: margins.marginBottom20 },
        React.createElement(FormTitle, null, "TTS Voice"),
        React.createElement(SelectTempWrapper, { value: voice, searchable: false, clearable: false, onChange: ({ value }) => set({ voice: value }), options: speechSynthesis.getVoices().map(({ name, lang, voiceURI }) => ({
                value: voiceURI,
                label: (React.createElement(Flex, null,
                    React.createElement(Text$1, { style: { marginRight: 4 } }, name),
                    React.createElement(Text$1, { color: Text$1.Colors.MUTED },
                        "[",
                        lang,
                        "]")))
            })) })),
    React.createElement(FormItem, { className: margins.marginBottom20 },
        React.createElement(FormTitle, null, "TTS Volume"),
        React.createElement(Slider, { initialValue: volume, maxValue: 100, minValue: 0, asValueChanges: (value) => set({ volume: value }) })),
    React.createElement(FormItem, { className: margins.marginBottom20 },
        React.createElement(FormTitle, null, "TTS Speed"),
        React.createElement(Slider, { initialValue: speed, maxValue: 10, minValue: 0.1, asValueChanges: (value) => set({ speed: value }), onValueRender: (value) => `${value.toFixed(2)}x`, markers: [0.1, 1, 2, 5, 10], onMarkerRender: (value) => `${value.toFixed(2)}x` })),
    React.createElement(FormDivider, { className: classNames(margins.marginTop20, margins.marginBottom20) }),
    React.createElement(FormItem, null,
        React.createElement(SwitchItem, { value: filterNames, onChange: (checked) => set({ filterNames: checked }), note: "Limit user & channel names to alphanumeric characters." }, "Enable Name Filter")),
    React.createElement(FormItem, null,
        React.createElement(SwitchItem, { value: filterBots, onChange: (checked) => set({ filterBots: checked }), note: "Disable notifications for bot users in voice." }, "Enable Bot Filter")),
    React.createElement(FormItem, null,
        React.createElement(SwitchItem, { value: filterStages, onChange: (checked) => set({ filterStages: checked }), note: "Disable notifications for stage voice channels." }, "Enable Stage Filter")),
    React.createElement(FormSection, null,
        React.createElement(FormTitle, { tag: "h3" }, "Messages"),
        React.createElement(FormText, { type: "description", className: margins.marginBottom20 }, "$user will get replaced with the respective User Nickname, $username with the User Account name and $channel with the respective Voice Channel name.")),
    ([
        {
            title: "Join Message (Other Users)",
            setting: "join"
        },
        {
            title: "Leave Message (Other Users)",
            setting: "leave"
        },
        {
            title: "Join Message (Self)",
            setting: "joinSelf"
        },
        {
            title: "Move Message (Self)",
            setting: "moveSelf"
        },
        {
            title: "Leave Message (Self)",
            setting: "leaveSelf"
        },
        {
            title: "Private Call channel name",
            setting: "privateCall"
        }
    ]).map(({ title, setting }, i) => (React.createElement(FormItem, { key: i, className: margins.marginBottom20 },
        React.createElement(FormTitle, null, title),
        React.createElement(Flex, { align: Flex.Align.CENTER },
            React.createElement("div", { style: { flexGrow: 1, marginRight: 20 } },
                React.createElement(TextInput, { value: settings[setting], placeholder: defaults[setting], onChange: (value) => set({ [setting]: value }) })),
            React.createElement(Button, { size: Button.Sizes.SMALL, onClick: () => speak(settings[setting]
                    .split("$user").join("user")
                    .split("$channel").join("channel")) }, "Test")))))));

const name = "VoiceEvents";
const author = "Zerthox";
const version = "2.0.0";
const description = "Add TTS Event Notifications to your selected Voice Channel. TeamSpeak feeling.";
const config = {
	name: name,
	author: author,
	version: version,
	description: description
};

const Events = Finder.byProps("dispatch", "subscribe");
const Channels = Finder.byProps("getChannel", "hasChannel");
const SelectedChannel = Finder.byProps("getChannelId", "getVoiceChannelId");
const VoiceStates = Finder.byProps("getVoiceStates", "hasVideo");
const Users = Finder.byProps("getUser", "getCurrentUser");
const Members = Finder.byProps("getMember", "isMember");
const Text = Finder.byName("Text");
const { MenuGroup, MenuItem } = Finder.byProps("MenuGroup", "MenuItem", "MenuSeparator") ?? {};
const VoiceContextMenu = Finder.query({ name: "ChannelListVoiceChannelContextMenu", source: ["isGuildStageVoice"] });
let prevStates = {};
const saveStates = () => {
    prevStates = { ...VoiceStates.getVoiceStatesForChannel(SelectedChannel.getVoiceChannelId()) };
};
const index = createPlugin({ ...config, settings }, ({ Logger, Patcher, Settings }) => {
    const findDefaultVoice = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length === 0) {
            Logger.error("No speech synthesis voices available");
            alert(config.name, React.createElement(Text, { color: Text.Colors.STANDARD },
                "Electron does not have any Speech Synthesis Voices available on your system.",
                React.createElement("br", null),
                "The plugin will be unable to function properly."));
            return null;
        }
        else {
            return voices.find((voice) => voice.lang === "en-US") ?? voices[0];
        }
    };
    Settings.defaults.voice = findDefaultVoice()?.voiceURI;
    if (Settings.get().voice === null) {
        Settings.set({ voice: Settings.defaults.voice });
    }
    const findCurrentVoice = () => {
        const uri = Settings.get().voice;
        const voice = speechSynthesis.getVoices().find((voice) => voice.voiceURI === uri);
        if (voice) {
            return voice;
        }
        else {
            Logger.warn(`Voice "${uri}" not found, reverting to default`);
            const defaultVoice = findDefaultVoice();
            Settings.set({ voice: defaultVoice.voiceURI });
            return defaultVoice;
        }
    };
    const speak = (message) => {
        const { volume, speed } = Settings.get();
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.voice = findCurrentVoice();
        utterance.volume = volume / 100;
        utterance.rate = speed;
        speechSynthesis.speak(utterance);
    };
    const processName = (name) => {
        return Settings.get().filterNames ? name.split("").map((char) => /[a-zA-Z0-9]/.test(char) ? char : " ").join("") : name;
    };
    const notify = (type, userId, channelId) => {
        const settings = Settings.get();
        const user = Users.getUser(userId);
        const channel = Channels.getChannel(channelId);
        const isDM = channel.isDM() || channel.isGroupDM();
        if (settings.filterBots && user.bot
            || settings.filterStages && channel.isGuildStageVoice()) {
            return;
        }
        const nick = Members.getMember(channel.getGuildId(), userId)?.nick ?? user.username;
        const channelName = isDM ? settings.privateCall : channel.name;
        speak(settings[type]
            .split("$username").join(processName(user.username))
            .split("$user").join(processName(nick))
            .split("$channel").join(processName(channelName)));
    };
    const listener = (event) => {
        for (const { userId, channelId } of event.voiceStates) {
            try {
                const prev = prevStates[userId];
                if (userId === Users.getCurrentUser().id) {
                    if (!channelId) {
                        notify("leaveSelf", userId, prev.channelId);
                        saveStates();
                    }
                    else if (!prev) {
                        notify("joinSelf", userId, channelId);
                        saveStates();
                    }
                    else if (channelId !== prev.channelId) {
                        notify("moveSelf", userId, channelId);
                        saveStates();
                    }
                }
                else {
                    const selectedChannelId = SelectedChannel.getVoiceChannelId();
                    if (!selectedChannelId) {
                        return;
                    }
                    if (!prev && channelId === selectedChannelId) {
                        notify("join", userId, channelId);
                        saveStates();
                    }
                    else if (prev && !VoiceStates.getVoiceStatesForChannel(selectedChannelId)[userId]) {
                        notify("leave", userId, selectedChannelId);
                        saveStates();
                    }
                }
            }
            catch (error) {
                Logger.error("Error processing voice state change, see details below");
                console.error(error);
            }
        }
    };
    return {
        start() {
            saveStates();
            Events.subscribe("VOICE_STATE_UPDATES", listener);
            Patcher.after(VoiceContextMenu, "default", ({ result }) => {
                const { children } = result.props;
                const index = children.findIndex((node) => [node?.props.children].flat()
                    .find((child) => child?.props.id === "delete-channel"));
                children.splice(index, 0, React.createElement(MenuGroup, null,
                    React.createElement(MenuItem, { isFocused: false, id: "voiceevents-clear", label: "Clear Notification queue", action: () => speechSynthesis.cancel() })));
                return result;
            });
        },
        stop() {
            prevStates = {};
            Events.unsubscribe("VOICE_STATE_UPDATES", listener);
        },
        settingsPanel: (props) => React.createElement(SettingsPanel, { speak: speak, ...props })
    };
});

module.exports = index;

/*@end @*/
