import {createPlugin, Finder, Utils, React, Discord} from "dium";
import {
    Dispatcher,
    ChannelStore,
    SelectedChannelStore,
    UserStore,
    GuildMemberStore,
    MediaEngineStore,
    Text,
    Menu
} from "dium/modules";
import {settings, SettingsPanel, NotificationType} from "./settings";
import config from "./config.json";

const VoiceStateStore = Finder.byProps("getVoiceStates", "hasVideo");

const {MenuItem} = Menu;

interface VoiceState {
    channelId: Discord.Snowflake;
    userId: Discord.Snowflake;
    sessionId: string;
    deaf: boolean;
    mute: boolean;
    selfMute: boolean;
    selfDeaf: boolean;
    selfVideo: boolean;
    selfStream: boolean;
    suppress: boolean;
    requestToSpeakTimestamp?: any;
}

let prevStates: Record<string, VoiceState> = {};
const saveStates = () => {
    prevStates = {...VoiceStateStore.getVoiceStatesForChannel(SelectedChannelStore.getVoiceChannelId())};
};

export default createPlugin({...config, settings}, ({Logger, Patcher, Settings}) => {
    // backwards compatibility for settings
    const loaded = Settings.current as any;
    for (const [key, value] of Object.entries(Settings.defaults.notifs)) {
        if (typeof loaded[key] === "string") {
            const {notifs} = Settings.current;
            notifs[key] = {...value, message: loaded[key]};
            Settings.update({notifs});
            Settings.delete(key);
        }
    }
    if (typeof loaded.privateCall === "string") {
        Settings.update({unknownChannel: loaded.privateCall});
        Settings.delete("privateCall");
    }

    const findDefaultVoice = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length === 0) {
            Logger.error("No speech synthesis voices available");
            Utils.alert(
                config.name,
                <Text color={Text.Colors.STANDARD}>
                    Electron does not have any Speech Synthesis Voices available on your system.
                    <br/>
                    The plugin will be unable to function properly.
                </Text>
            );
            return null;
        } else {
            return voices.find((voice) => voice.lang === "en-US") ?? voices[0];
        }
    };

    // update default voice
    Settings.defaults.voice = findDefaultVoice()?.voiceURI;
    if (Settings.current.voice === null) {
        Settings.update({voice: Settings.defaults.voice});
    }

    const findCurrentVoice = () => {
        const uri = Settings.current.voice;
        const voice = speechSynthesis.getVoices().find((voice) => voice.voiceURI === uri);
        if (voice) {
            return voice;
        } else {
            Logger.warn(`Voice "${uri}" not found, reverting to default`);
            const defaultVoice = findDefaultVoice();
            Settings.update({voice: defaultVoice.voiceURI});
            return defaultVoice;
        }
    };

    const speak = (message: string) => {
        const {volume, speed} = Settings.current;

        const utterance = new SpeechSynthesisUtterance(message);
        utterance.voice = findCurrentVoice();
        utterance.volume = volume / 100;
        utterance.rate = speed;

        speechSynthesis.speak(utterance);
    };

    const processName = (name: string) => {
        return Settings.current.filterNames ? name.split("").map((char) => /[a-zA-Z0-9]/.test(char) ? char : " ").join("") : name;
    };

    const notify = (type: NotificationType, userId: string, channelId: string) => {
        const settings = Settings.current;

        // check for enabled
        if (!settings.notifs[type].enabled) {
            return;
        }

        const user = UserStore.getUser(userId) as Discord.User;
        const channel = ChannelStore.getChannel(channelId) as Discord.Channel;

        // check for filters
        if (
            settings.filterBots && user?.bot
            || settings.filterStages && channel?.isGuildStageVoice()
        ) {
            return;
        }

        // resolve names
        const nick = GuildMemberStore.getMember(channel?.getGuildId(), userId)?.nick ?? user.username;
        const channelName = (!channel || channel.isDM() || channel.isGroupDM()) ? settings.unknownChannel : channel.name;

        // speak message
        speak(settings.notifs[type].message
            .split("$username").join(processName(user.username))
            .split("$user").join(processName(nick))
            .split("$channel").join(processName(channelName))
        );
    };

    const selfMuteListener = () => {
        const userId = UserStore.getCurrentUser().id;
        const channelId = SelectedChannelStore.getVoiceChannelId();
        notify(MediaEngineStore.isSelfMute() ? "mute" : "unmute", userId, channelId);
    };

    const selfDeafListener = () => {
        const userId = UserStore.getCurrentUser().id;
        const channelId = SelectedChannelStore.getVoiceChannelId();
        notify(MediaEngineStore.isSelfDeaf() ? "deafen" : "undeafen", userId, channelId);
    };

    const voiceStateListener = (event) => {
        for (const {userId, channelId} of event.voiceStates as VoiceState[]) {
            try {
                const prev = prevStates[userId];

                if (userId === UserStore.getCurrentUser().id) {
                    // user is self
                    if (!channelId) {
                        // no channel is leave
                        notify("leaveSelf", userId, prev.channelId);
                        saveStates();
                    } else if (!prev) {
                        // no previous state is join
                        notify("joinSelf", userId, channelId);
                        saveStates();
                    } else if (channelId !== prev.channelId) {
                        // previous state in different channel is move
                        notify("moveSelf", userId, channelId);
                        saveStates();
                    }
                } else {
                    // check for current channel
                    const selectedChannelId = SelectedChannelStore.getVoiceChannelId();
                    if (!selectedChannelId) {
                        // user is not in voice
                        return;
                    }

                    if (!prev && channelId === selectedChannelId) {
                        // no previous state & same channel is join
                        notify("join", userId, channelId);
                        saveStates();
                    } else if (prev && !VoiceStateStore.getVoiceStatesForChannel(selectedChannelId)[userId]) {
                        // previous state & no current state is leave
                        notify("leave", userId, selectedChannelId);
                        saveStates();
                    }
                }
            } catch (error) {
                Logger.error("Error processing voice state change, see details below");
                console.error(error);
            }
        }
    };

    return {
        async start() {
            // save initial voice states
            saveStates();

            // listen for updates
            Dispatcher.subscribe("VOICE_STATE_UPDATES", voiceStateListener);
            Logger.log("Subscribed to voice state events");

            Dispatcher.subscribe("AUDIO_TOGGLE_SELF_MUTE", selfMuteListener);
            Logger.log("Subscribed to self mute events");

            Dispatcher.subscribe("AUDIO_TOGGLE_SELF_DEAF", selfDeafListener);
            Logger.log("Subscribed to self deaf events");

            // wait for context menu lazy load
            const useChannelHideNamesItem = await Patcher.waitForContextMenu(
                () => Finder.query({name: "useChannelHideNamesItem"}) as {default: (channel: Discord.Channel) => JSX.Element}
            );

            // add queue clear item
            Patcher.after(useChannelHideNamesItem, "default", ({result}) => {
                if (result) {
                    return (
                        <>
                            {result}
                            <MenuItem
                                isFocused={false}
                                id="voiceevents-clear"
                                label="Clear VoiceEvents queue"
                                action={() => speechSynthesis.cancel()}
                            />
                        </>
                    );
                }
            });
        },
        stop() {
            // reset
            prevStates = {};

            Dispatcher.unsubscribe("VOICE_STATE_UPDATES", voiceStateListener);
            Logger.log("Unsubscribed from voice state events");

            Dispatcher.unsubscribe("AUDIO_TOGGLE_SELF_MUTE", selfMuteListener);
            Logger.log("Unsubscribed from self mute events");

            Dispatcher.unsubscribe("AUDIO_TOGGLE_SELF_DEAF", selfDeafListener);
            Logger.log("Unsubscribed from self deaf events");
        },
        SettingsPanel: () => {
            const [current, defaults, setSettings] = Settings.useStateWithDefaults();
            return <SettingsPanel current={current} defaults={defaults} onChange={setSettings} speak={speak}/>;
        }
    };
});
