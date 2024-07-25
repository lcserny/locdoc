import {NODEJS_CLI, NodeJSCliDeployer} from "./nodejs-cli";
import {ContainerDeployer} from "./container";
import {SYSTEMD, SystemDDeployer} from "./systemd";
import type {Logger} from "winston";
import type {SimpleGit} from "simple-git";
import type {Docker} from "docker-cli-js";
import type {Deployer, Manifest} from "./lib";

export class DeployRetriever {

    private readonly type: string;
    private readonly workDir: string;
    private readonly logger: Logger;
    // TODO: might not be ok from tests
    private readonly git?: SimpleGit;
    private readonly docker?: Docker;
    private readonly manifest: Manifest;
    
    constructor(type: string, workDir: string, manifest: Manifest,
                logger: Logger, git?: SimpleGit, docker?: Docker) {
        this.type = type;
        this.workDir = workDir;
        this.manifest = manifest;
        this.logger = logger;
        this.git = git;
        this.docker = docker;
    }

    getDeployer(): Deployer {
        let deployer;
        switch (this.type) {
            case NODEJS_CLI:
                deployer = new NodeJSCliDeployer(this.workDir, this.manifest, this.logger, this.git);
                break;
            case SYSTEMD:
                deployer = new SystemDDeployer(this.workDir, this.manifest, this.logger, this.git);
                break;
            default:
                deployer = new ContainerDeployer(this.workDir, this.manifest, this.logger, this.docker, this.git);
                break;
        }
        return deployer;
    }
}
