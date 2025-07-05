import Dockerode, {type ContainerCreateOptions} from "dockerode";
import fs from "node:fs";
import {ContainerWrapper, ContainerDeploy, DockerWrapper} from "../../api/container";

export class DefaultContainer implements ContainerWrapper {

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

export class DefaultDocker implements DockerWrapper {

    private dockerode: Dockerode;

    constructor() {
        this.dockerode = new Dockerode();
    }

    async createContainer(dockerImage: string, deploy: ContainerDeploy): Promise<ContainerWrapper> {
        const parser = new ContainerOptionsParser();
        const options = parser.parseRunOptions(dockerImage, deploy);
        const newContainer = await this.dockerode.createContainer(options);
        return new DefaultContainer(newContainer);
    }

    async getContainer(filterName: string): Promise<ContainerWrapper | undefined> {
        const containers = await this.dockerode.listContainers({ filters: { name: [filterName] }, all: true });
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

    parseRunOptions(imageName: string, deploy: ContainerDeploy): ContainerCreateOptions {
        const options: ContainerCreateOptions = {};
        options.name = deploy.name;
        options.Image = imageName;
        options.AttachStdout = true;
        options.HostConfig = {};
        options.ExposedPorts = {};
        options.Env = [];

        if (deploy.networkMode) {
            options.HostConfig.NetworkMode = deploy.networkMode;
        }

        if (deploy.envFile) {
            options.Env = [...options.Env, ...this.parseEnvFile(deploy.envFile)];
        }

        if (deploy.envVars) {
            options.Env.push(...deploy.envVars);
        }

        if (deploy.memoryLimit) {
            options.HostConfig.Memory = this.parseMemory(deploy.memoryLimit);
        }

        if (deploy.restartPolicy) {
            options.HostConfig.RestartPolicy = { Name: this.removeQuotes(deploy.restartPolicy) };
        }

        if (deploy.addHosts) {
            options.HostConfig.ExtraHosts = deploy.addHosts.map(host => this.removeQuotes(host));
        }

        if (deploy.volumes) {
            options.HostConfig.Binds = deploy.volumes.map(volume => this.removeQuotes(volume));
        }

        if (deploy.ports) {
            for (const port of deploy.ports) {
                this.setPorts(options, port);
            }
        }

        return options;
    }
}
