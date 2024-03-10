import * as docker from "docker-cli-js";
import * as path from "path";
import { checkDockerfileExists } from "./fs.js";

export class DockerHandler {
    constructor(logger, manifest, artifactRepoDir) {
        this.logger = logger;
        this.cli = new docker.Docker({ echo: false });
        this.manifest = manifest;
        this.artifactRepoDir = artifactRepoDir;

        checkDockerfileExists(artifactRepoDir, manifest.artifact.dockerFile);
    }

    async build() {
        const dockerImage = `${this.manifest.image.name}:${this.manifest.image.version}`;
        this.logger.info(`Building Docker image '${dockerImage}'`);
        const dockerFilePath = path.join(this.artifactRepoDir, this.manifest.artifact.dockerFile);
        await this.cli.command(`build -t ${dockerImage} -f ${dockerFilePath} ${this.artifactRepoDir}`);
    }

    async config() {
        this.logger.info(`Configuring container networking`);

        const networkName = this.manifest.deploy.network;
        if (networkName) {
            const dockerResp = await this.cli.command(`network ls --filter name=${networkName} --format {{.Name}}`);
            if (!dockerResp.raw) {
                await this.cli.command(`network create ${networkName}`);
                // await this.cli.command(`network rm ${networkName}`);
            }
        }
    }

    async start() {
        const containerName = this.manifest.deploy.name;
        this.logger.info(`Starting container '${containerName}'`);
        
        const dockerResp = await this.cli.command(`container ls -a --filter name=${containerName} --format {{.ID}}:{{.State}}`);
        if (dockerResp.raw) {
            const split = dockerResp.raw.split(":");
            const containerId = split[0];
            const containerState = split[1].replace(/(\r\n|\n|\r)/gm,"");
            if (containerState === "running") {
                await this.cli.command(`container stop ${containerId}`);
            }
            await this.cli.command(`container rm ${containerId}`);
        }

        let runFlags = this.manifest.deploy.runFlags;
        if (!runFlags.includes("--network")) {
            runFlags += " --network " + this.manifest.deploy.network;
        }

        await this.cli.command(`run -d ${runFlags} --name ${containerName} ${this.manifest.image.name}:${this.manifest.image.version}`);
        // await this.cli.command(`run -d ${runFlags} --name ${containerName} ${this.manifest.image.name}:${this.manifest.image.version}`);
    }

    async clean() {
        this.logger.info(`Cleaning container build cache`);
        await this.cli.command(`builder prune -f`);
    }
}
