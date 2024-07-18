const path = require("node:path");
const fs = require("node:fs/promises");
const simpleGit = require("simple-git");
const util = require("node:util");
const child_process = require("node:child_process");

const exec = util.promisify(child_process.exec);

function getRandomNumberAsString(min, max) {
    return Math.floor(Math.random() * (max - min) + min).toString();
}

async function symlinkExists(symlinkPath) {
    try {
        await fs.lstat(symlinkPath);
        return true;
    } catch (e) {
        return false;
    }
}

class BaseManifest {
    constructor(randomName) {
        this.name = randomName
    }

    validate() {
        throw new Error("not implemented");
    }
}

class BaseDeployer {
    constructor(logger, workDir, manifest, git) {
        this.logger = logger;
        this.workDir = workDir;
        this.manifest = manifest;
        this.git = git || simpleGit();
    }

    async cloneArtifactRepo() {
        this.logger.info(`Cloning artifact repo`);
        const artifactRepoDir = path.join(this.workDir, this.manifest.deploy.name);
        await fs.mkdir(artifactRepoDir, {recursive: true});
        await this.git.clone(this.manifest.artifact.repo, artifactRepoDir, {"--branch": this.manifest.artifact.tag});

        return artifactRepoDir;
    }

    async cloneConfigRepo(artifactRepoDir) {
        const configRepoDir = path.join(artifactRepoDir, this.manifest.config.destinationPath);
        await fs.mkdir(configRepoDir, {recursive: true});

        this.logger.info("Cloning config repo");
        const tmpConfigRepoDir = path.join(this.workDir, getRandomNumberAsString(10000, 99999));
        await fs.mkdir(tmpConfigRepoDir, {recursive: true});
        await this.git.clone(this.manifest.config.repo, tmpConfigRepoDir, {"--branch": this.manifest.config.tag});

        this.logger.info("Merging config in artifact");
        await fs.cp(tmpConfigRepoDir, configRepoDir, {recursive: true});
        await fs.rm(tmpConfigRepoDir, {recursive: true});

        return configRepoDir;
    }

    async executeBuildCommand(artifactRepoDir) {
        this.logger.info("Executing build command");
        await exec(`bash -c 'cd ${artifactRepoDir} && ${this.manifest.artifact.buildCmd}'`);
    }
}

module.exports = {
    getRandomNumberAsString,
    symlinkExists,
    BaseManifest,
    BaseDeployer,
    exec
}