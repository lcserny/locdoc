import type {Manifest} from "./lib";
import {BaseDeployer, BaseManifest} from "./lib";
import type {Logger} from "winston";
import {DefaultDocker} from "./container/dockerode";
import type {Git} from "./git";

export const CONTAINER = "container";

export interface ContainerWrapper {
    start(): Promise<void>;
    stop(): Promise<void>;
    remove(): Promise<void>;

    getStatus(): Promise<string>;
}

export interface DockerWrapper {
    cleanup(): Promise<void>;

    // eslint-disable-next-line no-unused-vars
    createContainer(dockerContainer: string, dockerImage: string, deployDescriptor: ContainerDeployDescriptor): Promise<ContainerWrapper>
    // eslint-disable-next-line no-unused-vars
    getContainer(filterName: string): Promise<ContainerWrapper | undefined>

    // eslint-disable-next-line no-unused-vars
    networkExists(filterName: string): Promise<boolean>
    // eslint-disable-next-line no-unused-vars
    createNetwork(networkName: string): Promise<void>;

    // eslint-disable-next-line no-unused-vars
    buildImage(imageName: string, src: string[], context: string): Promise<void>;
}

export class ContainerDeployer extends BaseDeployer {

    protected manifest: ContainerManifest;

    private docker: DockerWrapper;

    constructor(workDir: string, manifest: Manifest, logger: Logger, docker: DockerWrapper = new DefaultDocker(), git?: Git) {
        super(logger, workDir, manifest, git);
        this.manifest = manifest as ContainerManifest;
        this.docker = docker;
    }

    async deploy() {
        const artifactRepoDir = await this.cloneArtifactRepo();
        await this.cloneConfigRepo(artifactRepoDir);
        if (this.manifest.artifact.buildCmd) {
            await this.executeBuildCommand(artifactRepoDir);
        }

        await this.buildImage(artifactRepoDir);

        await this.createNetwork();

        await this.cleanExistingContainer();

        this.handleDeployEnvFile(artifactRepoDir);

        await this.createContainer(this.manifest.deploy.name, this.imageName());

        await this.cleanupBuild();
    }

    async cleanupBuild() {
        await this.docker.cleanup();
    }

    private handleDeployEnvFile(artifactRepoDir: string) {
        if (this.manifest.deploy.envFile) {
            this.manifest.deploy.envFile = this.replaceRepoDir(artifactRepoDir, this.manifest.deploy.envFile);
        }
    }

    async createContainer(dockerContainer: string, dockerImage: string) {
        this.logger.info(`Starting new docker container '${dockerContainer}'`);

        const newContainer = await this.docker.createContainer(dockerContainer, dockerImage, this.manifest.deploy);
        newContainer.start()
            .then(() => this.logger.info("Container started successfully"))
            .catch(err => this.logger.error("Error starting container:", err));
    }

    async cleanExistingContainer() {
        const dockerContainer = this.manifest.deploy.name;
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
        await this.docker.buildImage(this.imageName(), [".", this.manifest.artifact.dockerFile], artifactRepoDir);
    }

    private imageName() {
        return `${this.manifest.image.name}:${this.manifest.image.version}`;
    }
}

export interface ContainerDeployDescriptor {
    networkMode?: string;
    envFile?: string;
    env?: string[];
    memLimit?: string;
    restart?: string;
    addHosts?: string[];
    volumes?: string[];
    ports?: string[];
}

export class ContainerManifest extends BaseManifest {
    artifact = {repo: "", tag: "master", dockerFile: "Dockerfile", buildCmd: ""};
    config = {repo: "", tag: "master", destinationPath: ""};
    image = {name: "", version: "1.0"};
    deploy: ContainerDeployDescriptor & {type: string, name: string} = {
        type: CONTAINER,
        name: ""
    };

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
