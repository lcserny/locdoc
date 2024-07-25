import path from "node:path";
import fs from "node:fs/promises";
import type {SimpleGit} from "simple-git";
import simpleGit from "simple-git";
import util from "node:util";
import child_process from "node:child_process";
import type {Logger} from "winston";
import type {NodeJSCliDeployer, NodeJSCliManifest} from "./nodejs-cli";
import type {SystemDDeployer, SystemDManifest} from "./systemd";
import type {ContainerDeployer, ContainerManifest} from "./container";

export const exec = util.promisify(child_process.exec);

export function getRandomNumberAsString(min: number, max: number) {
    return Math.floor(Math.random() * (max - min) + min).toString();
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

export interface Git {
    // eslint-disable-next-line no-unused-vars
    clone(repo: string, path: string, branch?: string): Promise<void>;
}

class DefaultGit implements Git {
    private git: SimpleGit = simpleGit();

    async clone(repo: string, path: string, branch?: string) {
        const options = branch ? {"--branch": branch} : undefined;
        await this.git.clone(repo, path, options);
    }
}

export interface DockerWrapper {
    // eslint-disable-next-line no-unused-vars
    command(cmd: string): Promise<any>;
}

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

    async executeBuildCommand(artifactRepoDir: string) {
        this.logger.info("Executing build command");
        await exec(`bash -c 'cd ${artifactRepoDir} && ${this.manifest.artifact.buildCmd}'`);
    }
}
