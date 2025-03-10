import path from "path";
import {promises as fs, readdirSync, readFileSync} from "fs";
import minimist from "minimist";
import chalk from "chalk";
import * as rollup from "rollup";
import rollupConfig from "../rollup.config";
import type {Meta} from "betterdiscord";

const repo = "Zerthox/BetterDiscord-Plugins";

const success = (msg: string) => console.log(chalk.green(msg));
const warn = (msg: string) => console.warn(chalk.yellow(`Warn: ${msg}`));
const error = (msg: string) => console.error(chalk.red(`Error: ${msg}`));

// find sources
const sourceFolder = path.resolve(__dirname, "../src");
const sourceEntries = readdirSync(sourceFolder, {withFileTypes: true}).filter((entry) => entry.isDirectory());
const wscript = readFileSync(path.resolve(__dirname, "wscript.js"), "utf8").split("\n").filter((line) => line.trim().length > 0).join("\n");

// parse args
const args = minimist(process.argv.slice(2), {boolean: ["dev", "watch"]});

// resolve input paths
let inputPaths: string[] = [];
if (args._.length === 0) {
    inputPaths = sourceEntries.map((entry) => path.resolve(sourceFolder, entry.name));
} else {
    for (const name of args._) {
        const entry = sourceEntries.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
        if (entry) {
            inputPaths.push(path.resolve(sourceFolder, entry.name));
        } else {
            warn(`Unknown plugin "${name}"`);
        }
    }
}

// check for inputs
if (inputPaths.length === 0) {
    error("No plugin inputs");
    process.exit(1);
}

// resolve output directory
const outDir = args.dev ? path.resolve(
    process.platform === "win32" ? process.env.APPDATA
        : process.platform === "darwin" ? path.resolve(process.env.HOME, "Library/Application Support")
            : path.resolve(process.env.HOME, ".config"),
    "BetterDiscord/plugins"
) : path.resolve(__dirname, "../dist/bd");

const watchers: Record<string, rollup.RollupWatcher> = {};

// build each input
for (const inputPath of inputPaths) {
    const outputPath = path.resolve(outDir, `${path.basename(inputPath)}.plugin.js`);

    if (args.watch) {
        // watch for changes
        watch(inputPath, outputPath).then(() => console.log(`Watching for changes in "${inputPath}"`));
    } else {
        // build once
        build(inputPath, outputPath);
    }
}
if (args.watch) {
    // keep process alive
    process.stdin.resume();
    process.stdin.on("end", () => {
        for (const watcher of Object.values(watchers)) {
            watcher.close();
        }
    });
}

async function build(inputPath: string, outputPath: string) {
    // parse config
    const config = await readConfig(inputPath);
    const {output: outputConfig, ...inputConfig} = rollupConfig;

    // bundle plugin
    const bundle = await rollup.rollup({
        ...inputConfig,
        input: path.resolve(inputPath, "index.tsx")
    });
    await bundle.write({
        ...outputConfig,
        ...genOutputOptions(config, outputPath)
    });
    success(`Built ${config.name} v${config.version} to "${outputPath}"`);

    await bundle.close();
}

async function watch(inputPath: string, outputPath: string) {
    const config = await readConfig(inputPath);
    const {output: outputConfig, plugins, ...inputConfig} = rollupConfig;
    const configPath = resolveConfig(inputPath);

    // start watching
    const watcher = rollup.watch({
        ...inputConfig,
        input: path.resolve(inputPath, "index.tsx"),
        output: {
            ...outputConfig,
            ...genOutputOptions(config, outputPath)
        },
        plugins: [
            ...plugins,
            {
                name: "config-watcher",
                buildStart() {
                    this.addWatchFile(configPath);
                }
            }
        ]
    });

    // close finished bundles
    watcher.on("event", (event) => {
        if (event.code === "BUNDLE_END") {
            success(`Built ${config.name} v${config.version} to "${outputPath}" [${event.duration}ms]`);
            event.result.close();
        }
    });

    // restart on config changes
    watcher.on("change", (file) => {
        // check for config changes
        if (file === configPath) {
            watchers[inputPath].close();
            watch(inputPath, outputPath);
        }

        console.log(`=> Changed "${file}"`);
    });

    watchers[inputPath] = watcher;
}

interface Config {
    name: string;
    version: string;
    author: string;
    description: string;
}

function resolveConfig(inputPath: string): string {
    return path.resolve(inputPath, "config.json");
}

async function readConfig(inputPath: string): Promise<Meta> {
    const config = JSON.parse(await fs.readFile(resolveConfig(inputPath), "utf8")) as Config;
    return {
        ...config,
        authorLink: `https://github.com/${config.author}`,
        website: `https://github.com/${repo}`,
        source: `https://github.com/${repo}/tree/master/src/${path.basename(inputPath)}`
    };
}

function toMeta(config: Meta): string {
    let result = "/**";
    for (const [key, value] of Object.entries(config)) {
        result += `\n * @${key} ${value.replace(/\n/g, "\\n")}`;
    }
    return result + "\n**/\n";
}

function genOutputOptions(config: Meta, outputPath: string) {
    return {
        file: outputPath,
        banner: toMeta(config) + `\n/*@cc_on @if (@_jscript)\n${wscript}\n@else @*/\n`,
        footer: "\n/*@end @*/"
    };
}
