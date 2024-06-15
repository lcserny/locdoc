import {getRandomNumberAsString} from "./util.js";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import simpleGit from "simple-git";
import util from "node:util";
import child_process from "node:child_process";
import {BaseManifest} from "./manifest.js";

const git = simpleGit();
const exec = util.promisify(child_process.exec);

export class NodeCliDeployer {
    constructor(workDir, manifest, logger) {
        this.workDir = workDir;
        this.manifest = manifest;
        this.logger = logger;
    }

    // TODO
    async deploy() {
        this.logger.info(`Cloning artifact repo`);
        const artifactRepoDir = path.join(this.workDir, this.manifest.image.name);
        await fs.mkdir(artifactRepoDir, {recursive: true});
        await git.clone(this.manifest.artifact.repo, artifactRepoDir, {"--branch": this.manifest.artifact.tag});

        const configRepoDir = path.join(artifactRepoDir, this.manifest.config.destinationPath);
        await fs.mkdir(configRepoDir, {recursive: true});

        this.logger.info("Cloning config repo");
        const tmpConfigRepoDir = path.join(this.workDir, getRandomNumberAsString(10000, 99999));
        await fs.mkdir(tmpConfigRepoDir, {recursive: true});
        await git.clone(this.manifest.config.repo, tmpConfigRepoDir, {"--branch": this.manifest.config.tag});

        this.logger.info("Merging config in artifact");
        await fs.readdir(tmpConfigRepoDir).then(files => {
            files.forEach((file) => {
                fs.rename(path.join(tmpConfigRepoDir, file), path.join(configRepoDir, file));
            });
        });

        this.logger.info("Executing build command");
        process.chdir(artifactRepoDir);
        await exec(`bash -c '${this.manifest.artifact.buildCmd}'`);
    }
}

export class NodeCliManifest extends BaseManifest {
    artifact = { repo: null, tag: "master", buildCmd: "npm test" };
    config = { repo: null, tag: "master", destinationPath: null };
    deploy = { type: "nodecli", binOut: null, bins: null };

    constructor(randomName) {
        super(randomName);
    }

    validate() {
        if (this.artifact?.repo == null) {
            throw new Error("manifest provided has no `artifact.repo`");
        }

        if (this.config?.repo == null) {
            throw new Error("manifest provided has no `config.repo`");
        }

        if (this.config?.destinationPath == null) {
            throw new Error("manifest provided has no `config.destinationPath`");
        }

        if (this.deploy?.binOut == null) {
            throw new Error("manifest provided has no `deploy.binOut`");
        }

        if (this.deploy?.bins == null || this.deploy?.bins.length < 1) {
            throw new Error("manifest provided has no `deploy.bins`");
        }
    }
}
