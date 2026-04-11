import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";
import type {Logger} from "winston";
import {BaseDeployer} from "../api/deploy";
import {BaseManifest} from "../api/manifest";
import type {Git} from "../api/vcs";
import {executeBash} from "./lib.ts";

export const SYSTEMD = "systemd";
export const SYSTEMD_BASIC = "systemd-basic";

const DELAY_KEY = "<DELAY>";
const NAME_KEY = "<NAME>";
const EXE_KEY = "<EXE>";

const delaySec = 5;

export class SystemDDeployer extends BaseDeployer {
    private readonly templatePath: string;
    protected manifest: SystemDManifest;
    
    constructor(workDir: string, manifest: SystemDManifest, logger: Logger, git: Git, templatePath?: string) {
        super(logger, workDir, manifest, git);
        this.manifest = manifest;
        this.templatePath = templatePath || path.join(__dirname, "..", "..", "resources", "templates", "systemd_basic");
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
        await this.createSystemDFile(servicePath, serviceName, artifactRepoDir);
        await this.reloadSystemDDaemon();
        await this.enableSystemDService(serviceName);
        await this.startSystemDService(serviceName);
        await this.checkStatusSystemDService(serviceName);
    }

    async checkStatusSystemDService(serviceName: string) {
        this.logger.info("Checking status of systemd service");
        await executeBash(`systemctl --user status ${serviceName}`);
    }

    async startSystemDService(serviceName: string) {
        this.logger.info("Starting systemd service");
        await executeBash(`systemctl --user start ${serviceName}`);
    }

    async enableSystemDService(serviceName: string) {
        this.logger.info("Enabling systemd service");
        await executeBash(`systemctl --user enable ${serviceName}`);
    }

    async reloadSystemDDaemon() {
        this.logger.info("Refreshing systemd service");
        await executeBash(`systemctl --user daemon-reload`);
    }

    async createSystemDFile(servicePath: string, serviceName: string, artifactRepoDir: string) {
        this.logger.info("Creating systemd service file");
        let contents = fs.readFileSync(this.templatePath, "utf8");
        contents = contents.replace(DELAY_KEY, String(delaySec));
        contents = contents.replaceAll(NAME_KEY, this.manifest.deploy.name);
        contents = contents.replace(EXE_KEY, this.replaceVars(`${this.manifest.deploy.cmdPrefix} ${this.manifest.deploy.preRunFlags} ${this.manifest.deploy.path} ${this.manifest.deploy.postRunFlags}`, artifactRepoDir).trim());

        fs.mkdirSync(servicePath, { recursive: true });
        fs.writeFileSync(path.join(servicePath, serviceName), contents);
    }

    async copyArtifact(artifactRepoDir: string) {
        this.logger.info("Copying built artifact to deploy path");
        fs.mkdirSync(path.dirname(this.manifest.deploy.path), { recursive: true });
        fs.cpSync(path.join(artifactRepoDir, this.manifest.artifact.buildExecutable), this.manifest.deploy.path);
    }

    async stopCurrentService(serviceName: string) {
        this.logger.info("Stopping current systemd service");
        try {
            await executeBash(`systemctl --user stop ${serviceName}`);
        } catch (_e) {
            this.logger.info("No current systemd service found");
        }
    }
}

export class SystemDBasicDeployer extends SystemDDeployer {

    async deploy(): Promise<void> {
        const servicePath = path.join(os.homedir(), ".config", "systemd", "user");
        const serviceName = `${this.manifest.deploy.name}.service`;

        await this.stopCurrentService(serviceName);
        await this.createSystemDFile(servicePath, serviceName);
        await this.reloadSystemDDaemon();
        await this.enableSystemDService(serviceName);
        await this.startSystemDService(serviceName);
        await this.checkStatusSystemDService(serviceName);
    }

    async createSystemDFile(servicePath: string, serviceName: string): Promise<void> {
        await super.createSystemDFile(servicePath, serviceName, "");
    }
}

export class SystemDManifest extends BaseManifest {
    artifact = {repo: "", tag: "master", buildCmd: "", buildExecutable: ""};
    config = {repo: "", tag: "master", destinationPath: ""};
    deploy = {type: SYSTEMD, name: this.name, path: "", preRunFlags: "", postRunFlags: "", cmdPrefix: ""};

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

export class SystemDBasicManifest extends SystemDManifest {

    validate() {
        if (this.deploy?.type == null) {
            throw new Error("manifest provided has no `deploy.type`");
        }

        if (this.deploy?.path == null) {
            throw new Error("manifest provided has no `deploy.path`");
        }
    }
}
