import path from "node:path";
import fs from "node:fs/promises";
import util from "node:util";
import child_process from "node:child_process";
import type {Logger} from "winston";
import winston, {transports} from "winston";
import type {NodeJSCliDeployer, NodeJSCliManifest} from "./nodejs-cli";
import type {SystemDDeployer, SystemDManifest} from "./systemd";
import type {ContainerDeployer, ContainerManifest} from "./container";
import type {Ora} from "ora";
import type {OptionValues} from "commander";
import {DefaultGit} from "./git/simple-git";
import type {Git} from "./git";

const { combine, timestamp, prettyPrint, printf, errors } = winston.format;

export const exec = util.promisify(child_process.exec);

export function getRandomNumberAsString(min: number, max: number) {
    return Math.floor(Math.random() * (max - min) + min).toString();
}

class SpinnerConsoleTransport extends transports.Console {

    private spinner?: Ora;

    constructor(spinner?: Ora) {
        super();
        this.spinner = spinner;
    }

    log(info: unknown, next: () => void) {
        const spinning = this.spinner?.isSpinning;
        if (spinning) {
            this.spinner?.stop();
        }
        super.log?.(info, next);
        if (spinning) {
            this.spinner?.start();
        }
    }
}

export function splitAtFirst(text: string, separator: string): [string, string] {
    const index = text.indexOf(separator);
    if (index === -1) {
        // Separator not found, return the original string as the first part
        return [text, ""];
    } else {
        const part1 = text.substring(0, index); // Or text.slice(0, index)
        const part2 = text.substring(index + separator.length); // Or text.slice(index + separator.length)
        return [part1, part2];
    }
}

export function createLogger(args: OptionValues, spinner?: Ora) {
    return winston.createLogger({
        level: "info",
        format: combine(errors({stack: true}), timestamp(), args.json
            ? prettyPrint()
            : printf(({timestamp, level, message, stack}) => {
                const text = `${timestamp} ${level.toUpperCase()} ${message}`;
                return stack ? text + '\n' + stack : text;
            })),
        transports: [new SpinnerConsoleTransport(spinner)]
    });
}

export async function symlinkExists(symlinkPath: string) {
    try {
        await fs.lstat(symlinkPath);
        return true;
    } catch (e) {
        return false;
    }
}

export type Manifest = NodeJSCliManifest | SystemDManifest | ContainerManifest;

export type Deployer = NodeJSCliDeployer | SystemDDeployer | ContainerDeployer;

export class BaseManifest {
    protected name: string;
    
    constructor(randomName: string) {
        this.name = randomName
    }

    validate() {
        throw new Error("not implemented");
    }
}

export class BaseDeployer {

    protected readonly manifest: Manifest
    protected logger: Logger;
    protected readonly workDir: string;
    protected git: Git;
    
    constructor(logger: Logger, workDir: string, manifest: Manifest, git: Git = new DefaultGit()) {
        this.logger = logger;
        this.workDir = workDir;
        this.manifest = manifest;
        this.git = git;
    }

    async cloneArtifactRepo() {
        this.logger.info(`Cloning artifact repo`);
        const artifactRepoDir = path.join(this.workDir, this.manifest.deploy.name);
        await fs.mkdir(artifactRepoDir, {recursive: true});
        await this.git.clone(this.manifest.artifact.repo, artifactRepoDir, this.manifest.artifact.tag);

        return artifactRepoDir;
    }

    async cloneConfigRepo(artifactRepoDir: string) {
        const configRepoDir = path.join(artifactRepoDir, this.manifest.config.destinationPath);
        await fs.mkdir(configRepoDir, {recursive: true});

        this.logger.info("Cloning config repo");
        const tmpConfigRepoDir = path.join(this.workDir, getRandomNumberAsString(10000, 99999));
        await fs.mkdir(tmpConfigRepoDir, {recursive: true});
        await this.git.clone(this.manifest.config.repo, tmpConfigRepoDir, this.manifest.config.tag);

        this.logger.info("Merging config in artifact");
        await fs.cp(tmpConfigRepoDir, configRepoDir, {recursive: true});
        await fs.rm(tmpConfigRepoDir, {recursive: true});

        return configRepoDir;
    }

    protected replaceRepoDir(artifactRepoDir: string, text?: string): string | undefined {
        if (text) {
            return text.replace("${repoDir}", artifactRepoDir);
        }
        return text;
    }

    async executeBuildCommand(artifactRepoDir: string) {
        this.logger.info("Executing build command");
        await exec(`bash -c '${this.manifest.artifact.buildCmd}'`, {cwd: artifactRepoDir});
    }
}
