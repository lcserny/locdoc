const {NodeJSCliDeployer, NODEJS_CLI} = require("./nodejs-cli");
const {ContainerDeployer} = require("./container");

class DeployRetriever {
    constructor(type, workDir, manifest, logger) {
        this.type = type;
        this.workDir = workDir;
        this.manifest = manifest;
        this.logger = logger;
    }

    getDeployer() {
        let deployer;
        switch (this.type) {
            case NODEJS_CLI:
                deployer = new NodeJSCliDeployer(this.workDir, this.manifest, this.logger);
                break;
            default:
                deployer = new ContainerDeployer(this.workDir, this.manifest, this.logger);
                break;
        }
        return deployer;
    }
}

module.exports = {DeployRetriever}