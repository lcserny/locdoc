const path = require("node:path");
const fs = require("node:fs/promises");
const simpleGit = require("simple-git");
const child_process = require("node:child_process");
const util = require("node:util");
const {getRandomNumberAsString, BaseManifest} = require("./lib");

const NODEJS_CLI = "nodejs-cli";

const git = simpleGit();
const exec = util.promisify(child_process.exec);

class NodeJSCliDeployer {
    constructor(workDir, manifest, logger) {
        this.workDir = workDir;
        this.manifest = manifest;
        this.logger = logger;
    }

    async deploy() {
        this.logger.info(`Cloning artifact repo`);
        const artifactRepoDir = path.join(this.workDir, this.manifest.deploy.name);
        await fs.mkdir(artifactRepoDir, {recursive: true});
        await git.clone(this.manifest.artifact.repo, artifactRepoDir, {"--branch": this.manifest.artifact.tag});

        const configRepoDir = path.join(artifactRepoDir, this.manifest.config.destinationPath);
        await fs.mkdir(configRepoDir, {recursive: true});

        this.logger.info("Cloning config repo");
        const tmpConfigRepoDir = path.join(this.workDir, getRandomNumberAsString(10000, 99999));
        await fs.mkdir(tmpConfigRepoDir, {recursive: true});
        await git.clone(this.manifest.config.repo, tmpConfigRepoDir, {"--branch": this.manifest.config.tag});

        this.logger.info("Merging config in artifact");
        await fs.cp(tmpConfigRepoDir, configRepoDir, {recursive: true});
        await fs.rm(tmpConfigRepoDir, {recursive: true});

        this.logger.info("Executing build command");
        process.chdir(artifactRepoDir);
        await exec(`bash -c '${this.manifest.artifact.buildCmd}'`);

        this.logger.info(`Moving cli to bin out: ${this.manifest.deploy.binOut}`);
        const newArtifactPath = path.join(this.manifest.deploy.binOut, path.basename(artifactRepoDir));
        if (await this.filExists(newArtifactPath)) {
            await fs.rm(newArtifactPath, {recursive: true});
        }
        await fs.rename(artifactRepoDir, newArtifactPath);

        this.logger.info(`Creating symlinks: ${JSON.stringify(this.manifest.deploy.bins, null, 2)}`);
        for (const [key, val] of Object.entries(this.manifest.deploy.bins)) {
            const target = path.join(newArtifactPath, val.toString());
            const link = path.join(this.manifest.deploy.binOut, key);
            if (await this.filExists(link)) {
                await fs.rm(link);
            }
            await fs.symlink(target, link);
        }
    }

    async filExists(pathToCheck) {
        try {
            await fs.access(pathToCheck);
            return true;
        } catch (ignored) {
            return false;
        }
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