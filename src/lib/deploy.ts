import {NODEJS_CLI, NodeJSCliDeployer, NodeJSCliManifest} from "./nodejs-cli";
import {CONTAINER, ContainerDeployer, ContainerManifest} from "./container";
import {SYSTEMD, SystemDDeployer, SystemDManifest} from "./systemd";
import * as os from "node:os";
import type {Logger} from "winston";
import {ManifestType} from "./manifest";
import {DockerWrapper} from "../api/container";
import { Git } from "../api/vcs";

export type DeployerType = NodeJSCliDeployer | SystemDDeployer | ContainerDeployer;

export class DeployRetriever {

    private readonly type: string;
    private readonly workDir: string;
    private readonly logger: Logger;
    private readonly git: Git;
    private readonly docker: DockerWrapper;
    private readonly manifest: ManifestType;
    
    constructor(type: string, workDir: string, manifest: ManifestType, logger: Logger, git: Git, docker: DockerWrapper) {
        this.type = type;
        this.workDir = workDir;
        this.manifest = manifest;
        this.logger = logger;
        this.git = git;
        this.docker = docker;
    }

    getDeployer(): DeployerType {
        const currentOs = os.platform();

        let deployer: DeployerType;
        switch (this.type) {
            case NODEJS_CLI:
                deployer = new NodeJSCliDeployer(this.workDir, this.manifest as NodeJSCliManifest, this.logger, this.git);
                break;
            case SYSTEMD:
                if (currentOs == "win32") {
                    throw new Error("Windows does not support SymtemD deployments.");
                }
                deployer = new SystemDDeployer(this.workDir, this.manifest as SystemDManifest, this.logger, this.git);
                break;
            case CONTAINER:
                deployer = new ContainerDeployer(this.workDir, this.manifest as ContainerManifest, this.logger, this.docker, this.git);
                break;
            default:
                throw new Error(`Unknown deploy type ${this.type}`);
        }

        return deployer;
    }
}
