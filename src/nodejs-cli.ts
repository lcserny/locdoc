import path from "node:path";
import fs from "node:fs/promises";
import type {Git, Manifest} from "./lib";
import {BaseDeployer, BaseManifest, symlinkExists} from "./lib";
import fse from "fs-extra";
import type {Logger} from "winston";

export const NODEJS_CLI = "nodejs-cli";

export class NodeJSCliDeployer extends BaseDeployer{
    protected manifest: NodeJSCliManifest;

    constructor(workDir: string, manifest: Manifest, logger: Logger, git?: Git) {
        super(logger, workDir, manifest, git);
        this.manifest = manifest as NodeJSCliManifest;
    }

    async deploy() {
        const artifactRepoDir = await this.cloneArtifactRepo();
        await this.cloneConfigRepo(artifactRepoDir);
        await this.executeBuildCommand(artifactRepoDir);
        const newArtifactPath = await this.moveCli(artifactRepoDir);
        await this.createSymlink(newArtifactPath);
    }

    async createSymlink(newArtifactPath: string) {
        this.logger.info(`Creating symlinks: ${JSON.stringify(this.manifest.deploy.bins, null, 2)}`);
        for (const [key, val] of Object.entries(this.manifest.deploy.bins)) {
            const target = path.join(newArtifactPath, val.toString());
            const link = path.join(this.manifest.deploy.binOut, key);
            if (await symlinkExists(link)) {
                await fs.rm(link);
            }
            await fs.symlink(target, link);
            await fs.chmod(link, "0755");
        }
    }

    async moveCli(artifactRepoDir: string) {
        this.logger.info(`Moving cli to bin out: ${this.manifest.deploy.binOut}`);
        const newArtifactPath = path.join(this.manifest.deploy.binOut, path.basename(artifactRepoDir));
        if (await fse.pathExists(newArtifactPath)) {
            await fs.rm(newArtifactPath, {recursive: true});
        }
        await fs.rename(artifactRepoDir, newArtifactPath);
        return newArtifactPath;
    }
}

export class NodeJSCliManifest extends BaseManifest {
    artifact = {repo: "", tag: "master", buildCmd: "npm install"};
    config = {repo: "", tag: "master", destinationPath: ""};
    deploy = {type: NODEJS_CLI, name: "", binOut: "", bins: Object};

    constructor(randomName: string) {
        super(randomName);
        this.deploy.name = this.name;
    }

    validate() {
        if (this.artifact?.repo == null) {
            throw new Error("manifest provided has no `artifact.repo`");
        }

        if (this.config?.repo == null) {
            throw new Error("manifest provided has no `config.repo`");
        }

        if (this.deploy?.binOut == null) {
            throw new Error("manifest provided has no `deploy.binOut`");
        }

        if (this.deploy?.bins == null || this.deploy?.bins.length < 1) {
            throw new Error("manifest provided has no `deploy.bins`");
        }
    }
}
