import {Docker} from "docker-cli-js";
import path from "node:path";
import type { Manifest} from "./lib";
import {BaseDeployer, BaseManifest} from "./lib";
import type {Logger} from "winston";
import type {SimpleGit} from "simple-git";

export const CONTAINER = "container";

export class ContainerDeployer extends BaseDeployer {
    private docker: Docker;
    protected manifest: ContainerManifest;
    
    constructor(workDir: string, manifest: Manifest, logger: Logger, docker?: Docker, git?: SimpleGit) {
        super(logger, workDir, manifest, git);
        this.manifest = manifest as ContainerManifest;
        this.docker = docker || new Docker({echo: false});
    }

    async deploy() {
        const artifactRepoDir = await this.cloneArtifactRepo();
        await this.cloneConfigRepo(artifactRepoDir);
        if (this.manifest.artifact.buildCmd) {
            await this.executeBuildCommand(artifactRepoDir);
        }
        const dockerImage = await this.buildImage(artifactRepoDir);
        const dockerNet = await this.createNetwork();

        const dockerContainer = this.manifest.deploy.name;
        await this.cleanExistingContainer(dockerContainer);

        const runFlags = this.ensureNetwork(dockerNet);
        await this.createContainer(dockerContainer, runFlags, dockerImage);

        await this.cleanupBuild();
    }

    async cleanupBuild() {
        await this.docker.command(`image prune -f`);
    }

    async createContainer(dockerContainer: string, runFlags: string, dockerImage: string) {
        this.logger.info(`Starting new docker container '${dockerContainer}'`);
        await this.docker.command(`run -d ${runFlags} --name ${dockerContainer} ${dockerImage}`);
    }

    ensureNetwork(dockerNet: string) {
        let runFlags: string = this.manifest.deploy.runFlags;
        if (!runFlags.includes("--network")) {
            runFlags += ` --network ${dockerNet}`;
        }
        return runFlags;
    }

    async cleanExistingContainer(dockerContainer: string) {
        const containersResp = await this.docker.command(`ps -a --filter name=${dockerContainer}`);
        if (containersResp.containerList.length > 0) {
            const container = containersResp.containerList[0];
            const containerId = container["container id"];
            this.logger.info(`Existing container found '${containerId}'`);
            const containerStatus = container.status;
            if (containerStatus.toLowerCase().includes("up")) {
                this.logger.info(`Stopping container '${dockerContainer}'`);
                await this.docker.command(`stop ${dockerContainer}`);
            }
            this.logger.info(`Removing existing container '${dockerContainer}'`);
            await this.docker.command(`rm -v ${dockerContainer}`);
        }
    }

    async createNetwork() {
        const dockerNet = this.manifest.deploy.network;
        if (dockerNet) {
            const networksResp = await this.docker.command(`network ls --filter name=${dockerNet}`);
            if (networksResp.network.length === 0) {
                this.logger.info(`Docker network '${dockerNet}' not found, creating...`);
                await this.docker.command(`network create ${dockerNet}`);
            }
        }
        return dockerNet;
    }

    async buildImage(artifactRepoDir: string) {
        this.logger.info("Building Docker image");
        const dockerImage = `${this.manifest.image.name}:${this.manifest.image.version}`;
        const dockerFilePath = path.join(artifactRepoDir, this.manifest.artifact.dockerFile);
        await this.docker.command(`build -t ${dockerImage} -f ${dockerFilePath} ${artifactRepoDir}`);
        return dockerImage;
    }
}

export class ContainerManifest extends BaseManifest {
    artifact = {repo: "", tag: "master", dockerFile: "Dockerfile", buildCmd: ""};
    config = {repo: "", tag: "master", destinationPath: ""};
    image = {name: "", version: "1.0"};
    deploy = {type: CONTAINER, name: "", network: "", runFlags: ""};

    constructor(randomName: string) {
        super(randomName);
        this.deploy.name = this.name;
        this.image.name = this.name + "-image";
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
    }
}
