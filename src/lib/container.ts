import type {Logger} from "winston";
import {BaseDeployer} from "../api/deploy";
import {BaseManifest} from "../api/manifest";
import {ContainerDeploy, DockerWrapper} from "../api/container";
import {Git} from "../api/vcs";

export const CONTAINER = "container";

export class ContainerDeployer extends BaseDeployer {

    protected manifest: ContainerManifest;

    private docker: DockerWrapper;

    constructor(workDir: string, manifest: ContainerManifest, logger: Logger, docker: DockerWrapper, git: Git) {
        super(logger, workDir, manifest, git);
        this.manifest = manifest;
        this.docker = docker;
    }

    async deploy() {
        const artifactRepoDir = await this.cloneArtifactRepo();
        await this.cloneConfigRepo(artifactRepoDir);
        if (this.manifest.artifact.buildCmd) {
            await this.executeBuildCommand(artifactRepoDir);
        }
        const dockerImage = await this.buildImage(artifactRepoDir);
        await this.createNetwork();

        await this.cleanExistingContainer(this.manifest.deploy.name);

        await this.createContainer(artifactRepoDir, this.manifest.deploy, dockerImage);

        await this.cleanupBuild();
    }

    async cleanupBuild() {
        await this.docker.cleanup();
    }

    async createContainer(artifactRepoDir: string, deploy: ContainerDeploy, dockerImage: string) {
        this.logger.info(`Starting new docker container '${deploy.name}'`);

        this.adjustParams(deploy, artifactRepoDir);

        const newContainer = await this.docker.createContainer(dockerImage, deploy);
        newContainer.start()
            .then(() => this.logger.info("Container started successfully"))
            .catch(err => this.logger.error("Error starting container:", err));
    }

    private adjustParams(deploy: ContainerDeploy, artifactRepoDir: string) {
        if (deploy.envFile) {
            deploy.envFile = this.replaceVars(deploy.envFile, artifactRepoDir);
        }
    }

    async cleanExistingContainer(dockerContainer: string) {
        const container = await this.docker.getContainer(dockerContainer);
        if (container) {
            this.logger.info(`Existing container found '${dockerContainer}'`);

            const status = await container.getStatus();
            if (status.toLowerCase().includes("up")) {
                this.logger.info(`Stopping container '${dockerContainer}'`);
                await container.stop();
            }
            this.logger.info(`Removing existing container '${dockerContainer}'`);
            await container.remove();
        }
    }

    async createNetwork() {
        const dockerNet = this.manifest.deploy.networkMode;
        if (dockerNet) {
            const networkExists = await this.docker.networkExists(dockerNet);
            if (!networkExists) {
                this.logger.info(`Docker network '${dockerNet}' not found, creating...`);
                await this.docker.createNetwork(dockerNet);
            }
        }
    }

    async buildImage(artifactRepoDir: string) {
        this.logger.info("Building Docker image");
        const dockerImage = `${this.manifest.image.name}:${this.manifest.image.version}`;
        await this.docker.buildImage(dockerImage, [".", this.manifest.artifact.dockerFile], artifactRepoDir);
        return dockerImage;
    }
}

export class ContainerManifest extends BaseManifest {
    artifact = {repo: "", tag: "master", dockerFile: "Dockerfile", buildCmd: ""};
    config = {repo: "", tag: "master", destinationPath: ""};
    image = {name: "", version: "1.0"};
    deploy: ContainerDeploy = {type: CONTAINER, name: ""};

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
