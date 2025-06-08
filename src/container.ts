import type {ContainerWrapper, DockerWrapper, Git, Manifest} from "./lib";
import {BaseDeployer, BaseManifest} from "./lib";
import type {Logger} from "winston";
import type {ContainerCreateOptions} from "dockerode";
import Dockerode from "dockerode";
import fs from "node:fs";

export const CONTAINER = "container";

class DefaultContainer implements ContainerWrapper {

    private container: Dockerode.Container;

    constructor(container: Dockerode.Container) {
        this.container = container;
    }

    async start(): Promise<void> {
        return this.container.start();
    }

    async stop(): Promise<void> {
        return this.container.stop();
    }

    async remove(): Promise<void> {
        return this.container.remove({ force: true, v: true });
    }

    async getStatus(): Promise<string> {
        const info = await this.container.inspect();
        return info.State.Status;
    }
}

class DefaultDocker implements DockerWrapper {

    private dockerode: Dockerode;

    constructor() {
        this.dockerode = new Dockerode();
    }

    async createContainer(dockerContainer: string, dockerImage: string, convertedCmd: string): Promise<ContainerWrapper> {
        const parser = new ContainerOptionsParser();
        const options = parser.parseRunOptions(dockerContainer, dockerImage, convertedCmd);
        const newContainer = await this.dockerode.createContainer(options);
        return new DefaultContainer(newContainer);
    }

    async getContainer(filterName: string): Promise<ContainerWrapper | undefined> {
        const containers = await this.dockerode.listContainers({ filters: { name: [filterName] }, all: true });
        console.log("found containers:");
        console.log(JSON.stringify(containers));
        if (containers.length === 0) {
            return undefined;
        }
        const container = this.dockerode.getContainer(containers[0].Id);
        return new DefaultContainer(container);
    }

    async networkExists(filterName: string): Promise<boolean> {
        const networks = await this.dockerode.listNetworks({ filters: { name: [filterName] } });
        return networks.length !== 0;
    }

    async createNetwork(networkName: string): Promise<void> {
        await this.dockerode.createNetwork({ Name: networkName });
    }

    async buildImage(imageName: string, src: string[], context: string): Promise<void> {
        const stream = await this.dockerode.buildImage({ src, context }, { t: imageName });
        await new Promise<void>((resolve, reject) => {
            stream.on("end", resolve);
            stream.on("error", reject);
            stream.on("data", () => {});
        });
    }

    async cleanup(): Promise<void> {
        await this.dockerode.pruneImages();
        await this.dockerode.pruneContainers();
        await this.dockerode.pruneVolumes();
        await this.dockerode.pruneNetworks();
    }
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
        const dockerImage = await this.buildImage(artifactRepoDir);
        const dockerNet = await this.createNetwork();

        const dockerContainer = this.manifest.deploy.name;
        await this.cleanExistingContainer(dockerContainer);

        const runFlags = this.ensureNetwork(dockerNet);
        await this.createContainer(artifactRepoDir, dockerContainer, runFlags, dockerImage);

        await this.cleanupBuild();
    }

    async cleanupBuild() {
        await this.docker.cleanup();
    }

    async createContainer(artifactRepoDir: string, dockerContainer: string, runFlags: string, dockerImage: string) {
        this.logger.info(`Starting new docker container '${dockerContainer}'`);

        const convertedCmd = this.replaceVars(runFlags, artifactRepoDir);
        const newContainer = await this.docker.createContainer(dockerContainer, dockerImage, convertedCmd);
        newContainer.start()
            .then(() => this.logger.info("Container started successfully"))
            .catch(err => this.logger.error("Error starting container:", err));
    }

    ensureNetwork(dockerNet: string) {
        let runFlags: string = this.manifest.deploy.runFlags;
        if (!runFlags.includes("--network") && dockerNet) {
            runFlags += ` --network=${dockerNet}`;
        }
        return runFlags;
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
        const dockerNet = this.manifest.deploy.network;
        if (dockerNet) {
            const networkExists = await this.docker.networkExists(dockerNet);
            if (!networkExists) {
                this.logger.info(`Docker network '${dockerNet}' not found, creating...`);
                await this.docker.createNetwork(dockerNet);
            }
        }
        return dockerNet;
    }

    async buildImage(artifactRepoDir: string) {
        this.logger.info("Building Docker image");
        const dockerImage = `${this.manifest.image.name}:${this.manifest.image.version}`;
        await this.docker.buildImage(dockerImage, [".", this.manifest.artifact.dockerFile], artifactRepoDir);
        return dockerImage;
    }
}

export class ContainerOptionsParser {

    private parseEnvFile(envFilePath: string): string[] {
        if (!fs.existsSync(envFilePath)) {
            throw new Error(`Environment file not found: ${envFilePath}`);
        }
        const envFile = fs.readFileSync(envFilePath, "utf8");
        const envLines = envFile.split("\n").filter(line => line.trim() && !line.startsWith("#"));
        return envLines.map(line => line.trim());
    }

    private parseMemory(memoryValue: string): number {
        let byteMultiplier = 1;

        if (memoryValue.endsWith("m")) {
            byteMultiplier = 1024 * 1024; // MB to bytes
        } else if (memoryValue.endsWith("g")) {
            byteMultiplier = 1024 * 1024 * 1024; // GB to bytes
        }

        const parsedValue = memoryValue.slice(0, -1);
        const memoryInBytes = parseInt(parsedValue, 10);

        if (isNaN(memoryInBytes)) {
            throw new Error(`Invalid memory value: ${memoryValue}`);
        }

        return memoryInBytes * byteMultiplier;
    }

    private setPorts(options: ContainerCreateOptions, value: string) {
        const [hostPort, containerPort] = value.split(":");
        const portKey = `${containerPort}/tcp`;
        options.ExposedPorts![portKey] = {};
        if (!options.HostConfig!.PortBindings) {
            options.HostConfig!.PortBindings = {};
        }
        options.HostConfig!.PortBindings[portKey] = [{
            HostIp: "0.0.0.0",
            HostPort: hostPort
        }];
    }

    private removeQuotes(value: string): string {
        if (value.startsWith('"') && value.endsWith('"')) {
            return value.slice(1, -1);
        }
        return value;
    }

    parseRunOptions(containerName: string, imageName: string, runFlags: string): ContainerCreateOptions {
        const options: ContainerCreateOptions = {};
        options.name = containerName;
        options.Image = imageName;
        options.AttachStdout = true;
        options.HostConfig = {};
        options.ExposedPorts = {};

        const runFlagsList = runFlags.split(" ");
        for (const runFlag of runFlagsList) {
            const [flag, value] = runFlag.split("=");
            switch (flag) {
                case "--env-file": {
                    options.Env = this.parseEnvFile(value);
                    break
                }
                case "--memory": {
                    options.HostConfig.Memory = this.parseMemory(value);
                    break;
                }
                case "--restart": {
                    options.HostConfig.RestartPolicy = { Name: this.removeQuotes(value) };
                    break;
                }
                case "--add-host": {
                    if (!options.HostConfig.ExtraHosts) {
                        options.HostConfig.ExtraHosts = [];
                    }
                    options.HostConfig.ExtraHosts.push(this.removeQuotes(value));
                    break
                }
                case "--volume": {
                    if (!options.HostConfig.Binds) {
                        options.HostConfig.Binds = [];
                    }
                    options.HostConfig.Binds.push(this.removeQuotes(value));
                    break;
                }
                case "--publish": {
                    this.setPorts(options, value);
                    break
                }
                default:
                    throw new Error("Unsupported run flag: " + runFlag);
            }
        }

        return options;
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
