const {NodeJSCliDeployer, NODEJS_CLI} = require("./nodejs-cli");
const {ContainerDeployer} = require("./container");
const {SYSTEMD, SystemDDeployer} = require("./systemd");

class DeployRetriever {
    constructor(type, workDir, manifest, logger, git, docker) {
        this.type = type;
        this.workDir = workDir;
        this.manifest = manifest;
        this.logger = logger;
        this.git = git;
        this.docker = docker;
    }

    getDeployer() {
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

module.exports = {DeployRetriever}