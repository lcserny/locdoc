import {ManifestType} from "../lib/manifest";
import type {Logger} from "winston";
import path from "node:path";
import fs from "node:fs/promises";
import {exec, getRandomNumberAsString} from "../lib/lib";
import {Git} from "./vcs";

// TODO add to rest of deployers + fields directly
export interface NamedDeploy {
    type: string;
    name: string;
}

export class BaseDeployer {

    protected readonly manifest: ManifestType
    protected logger: Logger;
    protected readonly workDir: string;
    protected git: Git;

    constructor(logger: Logger, workDir: string, manifest: ManifestType, git: Git) {
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

    protected replaceVars(cmd: string, artifactRepoDir: string): string {
        return cmd.replace("${repoDir}", artifactRepoDir);
    }

    async executeBuildCommand(artifactRepoDir: string) {
        this.logger.info("Executing build command");
        await exec(`bash -c '${this.manifest.artifact.buildCmd}'`, {cwd: artifactRepoDir});
    }
}