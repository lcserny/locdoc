import {Docker} from "docker-cli-js";
import type {DockerWrapper, Git, Manifest} from "./lib";
import {BaseDeployer, BaseManifest} from "./lib";
import type {Logger} from "winston";
import Dockerode, {ContainerCreateOptions} from "dockerode";
import fs from "node:fs";

export const CONTAINER = "container";

class DefaultDocker implements DockerWrapper {
    private docker: Docker = new Docker({echo: false});

    async command<T>(cmd: string): Promise<T> {
        return this.docker.command(cmd);
    }
}

interface DockerContainers {
    containerList: {
        status: string;
        "container id": string;
    }[];
}

interface DockerNetworks {
    network: unknown[];
}

export class ContainerDeployer extends BaseDeployer {
    protected manifest: ContainerManifest;

    private dockerode: Dockerode;
    
    constructor(workDir: string, manifest: Manifest, logger: Logger, docker: DockerWrapper = new DefaultDocker(), git?: Git) {
        super(logger, workDir, manifest, git);
        this.manifest = manifest as ContainerManifest;

        this.dockerode = new Dockerode();
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
        await this.dockerode.pruneImages();
        await this.dockerode.pruneContainers();
        await this.dockerode.pruneVolumes();
        await this.dockerode.pruneNetworks();
    }

    async createContainer(artifactRepoDir: string, dockerContainer: string, runFlags: string, dockerImage: string) {
        this.logger.info(`Starting new docker container '${dockerContainer}'`);

        const parser = new ContainerOptionsParser();
        const convertedCmd = this.replaceVars(runFlags, artifactRepoDir);
        const options = parser.parseRunOptions(dockerContainer, dockerImage, convertedCmd);

        const newContainer = await this.dockerode.createContainer(options);
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
        const containers = await this.dockerode.listContainers({ filters: { name: [dockerContainer] } });
        if (containers.length > 0) {
            const containerInfo = containers[0];
            const containerId = containerInfo.Id;
            const container = this.dockerode.getContainer(containerId);
            this.logger.info(`Existing container found '${containerId}'`);
            if (containerInfo.Status.toLowerCase().includes("up")) {
                this.logger.info(`Stopping container '${dockerContainer}'`);
                await container.stop();
            }
            this.logger.info(`Removing existing container '${dockerContainer}'`);
            await container.remove({ force: true, v: true });
        }
    }

    async createNetwork() {
        const dockerNet = this.manifest.deploy.network;
        if (dockerNet) {
            const networks = await this.dockerode.listNetworks({ filters: { name: [dockerNet] } });
            if (networks.length === 0) {
                this.logger.info(`Docker network '${dockerNet}' not found, creating...`);
                await this.dockerode.createNetwork({ Name: dockerNet });
            }
        }
        return dockerNet;
    }

    async buildImage(artifactRepoDir: string) {
        this.logger.info("Building Docker image");
        const dockerImage = `${this.manifest.image.name}:${this.manifest.image.version}`;

        const stream = await this.dockerode.buildImage({ src: [".", this.manifest.artifact.dockerFile], context: artifactRepoDir }, { t: dockerImage });
        await new Promise<void>((resolve, reject) => {
            stream.on("end", resolve);
            stream.on("error", reject);
            stream.on("data", () => {});
        });

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

    parseRunOptions(containerName: string, imageName: string, runFlags: string): ContainerCreateOptions {
        /*

        runFlags: --memory=128m --restart=unless-stopped --expose=10010:10010 --add-host="host.docker.internal:host-gateway" --volume=/home/leonardo/keys:/keys
        runFlags: --memory=48m --restart=unless-stopped --expose=10030:80 --env-file=${repoDir}/src/environments/vars.sh

        * --memory > HostConfig.Memory number
        * --restart > HostConfig.RestartPolicy HostRestartPolicy
        * --expose > HostConfig.PortBindings ports list
        * --env-file > parse manually to Env list
        * --add-host > HostConfig.ExtraHosts
        * --volume > HostConfig.Binds
        * */

        const runFlagsList = runFlags.split(" ");
        const options: ContainerCreateOptions = {};

        for (const runFlag of runFlagsList) {
            const [flag, value] = runFlag.split("=");
            switch (flag) {
                case "--env-file": {
                    options.Env = this.parseEnvFile(value);
                }
            }
        }
        //     if (runFlag.startsWith("--memory=")) {
        //         const memoryValue = runFlag.split("=")[1];
        //         options.HostConfig = { Memory: parseInt(memoryValue) * 1024 * 1024 }; // Convert MB to bytes
        //     } else if (runFlag.startsWith("--restart=")) {
        //         const restartPolicy = runFlag.split("=")[1];
        //         options.HostConfig = { RestartPolicy: { Name: restartPolicy } };
        //     } else if (runFlag.startsWith("--expose=")) {
        //         const portMapping = runFlag.split("=")[1].split(":");
        //         options.ExposedPorts = { [`${portMapping[0]}/tcp`]: {} };
        //         options.HostConfig = { PortBindings: { [`${portMapping[0]}/tcp`]: [{ HostIp: "
        // }

        return options;

        // return {
        //     name: containerName,
        //     Image: imageName,
        //     AttachStdout: true,
        //     Env: [
        //         "API_URL=http://192.168.68.199:10020/api/v1",
        //         "SECURITY_URL=http://192.168.68.199:10010/security"
        //     ],
        //     ExposedPorts: {
        //         ["80/tcp"]: {},
        //     },
        //     HostConfig: {
        //         Memory: 48 * 1024 * 1024,
        //         RestartPolicy: {
        //             Name: "unless-stopped"
        //         },
        //         PortBindings: {
        //             ["80/tcp"]: [
        //                 {
        //                     HostIp: "0.0.0.0",
        //                     HostPort: "10030"
        //                 }
        //             ]
        //         }
        //     }
        // };
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
