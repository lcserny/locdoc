import path from "node:path";
import type {Git, Manifest} from "./lib";
import {BaseDeployer, BaseManifest, exec} from "./lib";
import fs from "node:fs/promises";
import os from "node:os";
import type {Logger} from "winston";

export const SYSTEMD = "systemd";

const NAME_KEY = "<NAME>";
const EXE_KEY = "<EXE>";

export class SystemDDeployer extends BaseDeployer {
    private readonly templatePath: string;
    protected manifest: SystemDManifest;
    
    constructor(workDir: string, manifest: Manifest, logger: Logger, git?: Git, templatePath?: string) {
        super(logger, workDir, manifest, git);
        this.manifest = manifest as SystemDManifest;
        this.templatePath = templatePath || path.join(__dirname, "..", "resources", "templates", "systemd_basic");
    }

    async deploy() {
        const artifactRepoDir = await this.cloneArtifactRepo();
        await this.cloneConfigRepo(artifactRepoDir);
        if (this.manifest.artifact.buildCmd) {
            await this.executeBuildCommand(artifactRepoDir);
        }

        const servicePath = path.join(os.homedir(), ".config", "systemd", "user");
        const serviceName = `${this.manifest.deploy.name}.service`;

        await this.stopCurrentService(serviceName);
        await this.copyArtifact(artifactRepoDir);
        await this.createSystemDFile(servicePath, serviceName);
        await this.reloadSystemDDaemon();
        await this.enableSystemDService(serviceName);
        await this.startSystemDService(serviceName);
        await this.checkStatusSystemDService(serviceName);
    }

    async checkStatusSystemDService(serviceName: string) {
        this.logger.info("Checking status of systemd service");
        await exec(`bash -c "systemctl --user status ${serviceName}"`);
    }

    async startSystemDService(serviceName: string) {
        this.logger.info("Starting systemd service");
        await exec(`bash -c "systemctl --user start ${serviceName}"`);
    }

    async enableSystemDService(serviceName: string) {
        this.logger.info("Enabling systemd service");
        await exec(`bash -c "systemctl --user enable ${serviceName}"`);
    }

    async reloadSystemDDaemon() {
        this.logger.info("Refreshing systemd service");
        await exec(`bash -c "systemctl --user daemon-reload"`);
    }

    async createSystemDFile(servicePath: string, serviceName: string) {
        this.logger.info("Creating systemd service file");
        let contents = await fs.readFile(this.templatePath, "utf8");
        contents = contents.replace(NAME_KEY, this.manifest.deploy.name);
        contents = contents.replace(EXE_KEY, `${this.manifest.deploy.cmdPrefix} ${this.manifest.deploy.preRunFlags} ${this.manifest.deploy.path} ${this.manifest.deploy.postRunFlags}`);

        await fs.mkdir(servicePath, {recursive: true});
        await fs.writeFile(path.join(servicePath, serviceName), contents);
    }

    async copyArtifact(artifactRepoDir: string) {
        this.logger.info("Copying built artifact to deploy path");
        await fs.cp(path.join(artifactRepoDir, this.manifest.artifact.buildExecutable), this.manifest.deploy.path);
    }

    async stopCurrentService(serviceName: string) {
        this.logger.info("Stopping current systemd service");
        await exec(`bash -c "systemctl --user stop ${serviceName}"`);
    }
}

export class SystemDManifest extends BaseManifest {
    artifact = {repo: "", tag: "master", buildCmd: "", buildExecutable: ""};
    config = {repo: "", tag: "master", destinationPath: ""};
    deploy = {type: SYSTEMD, name: this.name, path: "", preRunFlags: "", postRunFlags: "", cmdPrefix: ""};

    constructor(randomName: string) {
        super(randomName);
    }

    validate() {
        if (this.artifact?.repo == null) {
            throw new Error("manifest provided has no `artifact.repo`");
        }

        if (this.artifact?.buildCmd == null) {
            throw new Error("manifest provided has no `artifact.buildCmd`");
        }

        if (this.artifact?.buildExecutable == null) {
            throw new Error("manifest provided has no `artifact.buildExecutable`");
        }

        if (this.config?.repo == null) {
            throw new Error("manifest provided has no `config.repo`");
        }

        if (this.config?.destinationPath == null) {
            throw new Error("manifest provided has no `config.destinationPath`");
        }

        // TODO: not ok?
        if (this.deploy?.type == null) {
            throw new Error("manifest provided has no `deploy.type`");
        }

        if (this.deploy?.path == null) {
            throw new Error("manifest provided has no `deploy.path`");
        }
    }
}
