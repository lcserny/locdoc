import {getRandomNumberAsString} from "./util.js";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import {Docker} from "docker-cli-js";
import simpleGit from "simple-git";
import util from "node:util";
import child_process from "node:child_process";
import {BaseManifest} from "./manifest.js";

const docker = new Docker({echo: false});
const git = simpleGit();
const exec = util.promisify(child_process.exec);

export class ContainerDeployer {
    constructor(workDir, manifest, logger) {
        this.workDir = workDir;
        this.manifest = manifest;
        this.logger = logger;
    }

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

        this.logger.info("Building Docker image");
        const dockerImage = `${this.manifest.image.name}:${this.manifest.image.version}`;
        const dockerFilePath = path.join(artifactRepoDir, this.manifest.artifact.dockerFile);
        await docker.command(`build -t ${dockerImage} -f ${dockerFilePath} ${artifactRepoDir}`);

        const dockerNet = this.manifest.deploy.network;
        if (dockerNet) {
            const networksResp = await docker.command(`network ls --filter name=${dockerNet}`);
            if (networksResp.network.length === 0) {
                this.logger.info(`Docker network '${dockerNet}' not found, creating...`);
                await docker.command(`network create ${dockerNet}`);
            }
        }

        const dockerContainer = this.manifest.deploy.name;
        const containersResp = await docker.command(`ps -a --filter name=${dockerContainer}`);
        if (containersResp.containerList.length > 0) {
            const container = containersResp.containerList[0];
            const containerId = container["container id"];
            this.logger.info(`Existing container found '${containerId}'`);
            const containerStatus = container.status;
            if (containerStatus.toLowerCase().includes("up")) {
                this.logger.info(`Stopping container '${dockerContainer}'`);
                await docker.command(`stop ${dockerContainer}`);
            }
            this.logger.info(`Removing existing container '${dockerContainer}'`);
            await docker.command(`rm -v ${dockerContainer}`);
        }

        let runFlags = this.manifest.deploy.runFlags;
        if (!runFlags.includes("--network")) {
            runFlags += ` --network ${dockerNet}`;
        }
        this.logger.info(`Starting new docker container '${dockerContainer}'`);
        await docker.command(`run -d ${runFlags} --name ${dockerContainer} ${dockerImage}`);

        await docker.command(`builder prune -f`);
    }
}

export class ContainerManifest extends BaseManifest {
    artifact = { repo: null, tag: "master", dockerFile: "Dockerfile", buildCmd: null };
    config = { repo: null, tag: "master", destinationPath: null };
    image = { name: "", version: "1.0" };
    deploy = { type: "container", name: "", network: undefined, runFlags: undefined };

    constructor(randomName) {
        super(randomName);
        this.deploy.name = this.name;
        this.image.name = this.name + "-image";
    }

    validate() {
        if (this.artifact?.repo == null) {
            throw new Error("manifest provided has no `artifact.repo`");
        }

        if (this.artifact?.buildCmd == null) {
            throw new Error("manifest provided has no `artifact.buildCmd`");
        }

        if (this.config?.repo == null) {
            throw new Error("manifest provided has no `config.repo`");
        }

        if (this.config?.destinationPath == null) {
            throw new Error("manifest provided has no `config.destinationPath`");
        }
    }
}
