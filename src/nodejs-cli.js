const path = require("node:path");
const fs = require("node:fs/promises");
const {BaseManifest, BaseDeployer} = require("./lib");
const fse = require("fs-extra");

const NODEJS_CLI = "nodejs-cli";

class NodeJSCliDeployer extends BaseDeployer{
    constructor(workDir, manifest, logger, git) {
        super(logger, workDir, manifest, git);
    }

    async deploy() {
        const artifactRepoDir = await this.cloneArtifactRepo();
        await this.cloneConfigRepo(artifactRepoDir);
        await this.executeBuildCommand(artifactRepoDir);
        const newArtifactPath = await this.moveCli(artifactRepoDir);
        await this.createSymlink(newArtifactPath);
    }

    async createSymlink(newArtifactPath) {
        this.logger.info(`Creating symlinks: ${JSON.stringify(this.manifest.deploy.bins, null, 2)}`);
        for (const [key, val] of Object.entries(this.manifest.deploy.bins)) {
            const target = path.join(newArtifactPath, val.toString());
            const link = path.join(this.manifest.deploy.binOut, key);
            if (await this.symlinkExists(link)) {
                await fs.rm(link);
            }
            await fs.symlink(target, link);
        }
    }

    async symlinkExists(symlinkPath) {
        try {
            await fs.lstat(symlinkPath);
            return true;
        } catch (e) {
            return false;
        }
    }

    async moveCli(artifactRepoDir) {
        this.logger.info(`Moving cli to bin out: ${this.manifest.deploy.binOut}`);
        const newArtifactPath = path.join(this.manifest.deploy.binOut, path.basename(artifactRepoDir));
        if (await fse.pathExists(newArtifactPath)) {
            await fs.rm(newArtifactPath, {recursive: true});
        }
        await fs.rename(artifactRepoDir, newArtifactPath);
        return newArtifactPath;
    }
}

class NodeJSCliManifest extends BaseManifest {
    artifact = {repo: null, tag: "master", buildCmd: "npm install"};
    config = {repo: null, tag: "master", destinationPath: ""};
    deploy = {type: NODEJS_CLI, name: "", binOut: null, bins: null};

    constructor(randomName) {
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

module.exports = {
    NodeJSCliManifest,
    NodeJSCliDeployer,
    NODEJS_CLI
}