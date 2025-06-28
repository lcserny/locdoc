import * as fs from "node:fs";
import type {ContainerWrapper, ContainerDeployDescriptor, DockerWrapper} from "../container";
import type { ContainerCreateOptions } from "dockerode";
// @ts-ignore stupid imports...
import Dockerode from "dockerode";
import type * as dockerode from "dockerode";

export class DefaultContainer implements ContainerWrapper {

    private container: dockerode.Container;

    constructor(container: dockerode.Container) {
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

    async createContainer(dockerContainer: string, dockerImage: string, deployDescriptor: ContainerDeployDescriptor): Promise<ContainerWrapper> {
        const parser = new ContainerOptionsParser();
        const options = parser.parseRunOptions(dockerContainer, dockerImage, deployDescriptor);
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
        const envLines = envFile.split("\n").filter((line: string) => line.trim() && !line.startsWith("#"));
        return envLines.map((line: string) => line.trim());
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

    parseRunOptions(containerName: string, imageName: string, deployDescriptor: ContainerDeployDescriptor): ContainerCreateOptions {
        const options: ContainerCreateOptions = {};
        options.name = containerName;
        options.Image = imageName;
        options.AttachStdout = true;
        options.HostConfig = {};
        options.ExposedPorts = {};
        options.Env = [];

        if (deployDescriptor.networkMode) {
            options.HostConfig.NetworkMode = deployDescriptor.networkMode;
        }

        if (deployDescriptor.envFile) {
            options.Env.push(...this.parseEnvFile(deployDescriptor.envFile));
        }

        if (deployDescriptor.env) {
            options.Env.push(...deployDescriptor.env.map(env => env.trim()));
        }

        if (deployDescriptor.memLimit) {
            options.HostConfig.Memory = this.parseMemory(deployDescriptor.memLimit);
        }

        if (deployDescriptor.restart) {
            options.HostConfig.RestartPolicy = { Name: this.removeQuotes(deployDescriptor.restart) };
        }

        if (deployDescriptor.addHosts) {
            if (!options.HostConfig.ExtraHosts) {
                options.HostConfig.ExtraHosts = [];
            }
            for (const host of deployDescriptor.addHosts) {
                options.HostConfig.ExtraHosts.push(this.removeQuotes(host));
            }
        }

        if (deployDescriptor.volumes) {
            if (!options.HostConfig.Binds) {
                options.HostConfig.Binds = [];
            }
            for (const volume of deployDescriptor.volumes) {
                options.HostConfig.Binds.push(this.removeQuotes(volume));
            }
        }

        if (deployDescriptor.ports) {
            options.ExposedPorts = {};
            options.HostConfig.PortBindings = {};
            for (const port of deployDescriptor.ports) {
                this.setPorts(options, port);
            }
        }

        return options;
    }
}
