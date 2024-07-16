const path = require("node:path");
const {BaseManifest, BaseDeployer, exec} = require("./lib");
const fs = require("node:fs/promises");
const os = require("node:os");

const SYSTEMD = "systemd";

const NAME_KEY = "<NAME>";
const EXE_KEY = "<EXE>";

class SystemDDeployer extends BaseDeployer {
    constructor(workDir, manifest, logger, git, templatePath) {
        super(logger, workDir, manifest, git);
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

    async checkStatusSystemDService(serviceName) {
        this.logger.info("Checking status of systemd service");
        await exec(`bash -c "systemctl --user status ${serviceName}"`);
    }

    async startSystemDService(serviceName) {
        this.logger.info("Starting systemd service");
        await exec(`bash -c "systemctl --user start ${serviceName}"`);
    }

    async enableSystemDService(serviceName) {
        this.logger.info("Enabling systemd service");
        await exec(`bash -c "systemctl --user enable ${serviceName}"`);
    }

    async reloadSystemDDaemon() {
        this.logger.info("Refreshing systemd service");
        await exec(`bash -c "systemctl --user daemon-reload"`);
    }

    async createSystemDFile(servicePath, serviceName) {
        this.logger.info("Creating systemd service file");
        let contents = await fs.readFile(this.templatePath, "utf8");
        contents = contents.replace(NAME_KEY, this.manifest.deploy.name);
        contents = contents.replace(EXE_KEY, `${this.manifest.deploy.cmdPrefix} ${this.manifest.deploy.preRunFlags} ${this.manifest.deploy.path} ${this.manifest.deploy.postRunFlags}`);

        await fs.mkdir(servicePath, {recursive: true});
        await fs.writeFile(path.join(servicePath, serviceName), contents);
    }

    async copyArtifact(artifactRepoDir) {
        this.logger.info("Copying built artifact to deploy path");
        await fs.cp(path.join(artifactRepoDir, this.manifest.artifact.buildExecutable), this.manifest.deploy.path);
    }

    async stopCurrentService(serviceName) {
        this.logger.info("Stopping current systemd service");
        await exec(`bash -c "systemctl --user stop ${serviceName}"`);
    }
}

class SystemDManifest extends BaseManifest {
    artifact = {repo: null, tag: "master", buildCmd: null, buildExecutable: null};
    config = {repo: null, tag: "master", destinationPath: null};
    deploy = {type: null, name: "", path: null, preRunFlags: "", postRunFlags: "", cmdPrefix: ""};

    constructor(randomName) {
        super(randomName);
        this.deploy.name = this.name;
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

        if (this.deploy?.type == null) {
            throw new Error("manifest provided has no `deploy.type`");
        }

        if (this.deploy?.path == null) {
            throw new Error("manifest provided has no `deploy.path`");
        }
    }
}

module.exports = {
    SystemDManifest,
    SystemDDeployer,
    SYSTEMD
}
