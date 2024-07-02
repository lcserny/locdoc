const YAML = require("yaml");
const fs = require("node:fs/promises");
const {NodeJSCliManifest, NODEJS_CLI} = require("./nodejs-cli");
const {ContainerManifest} = require("./container");
const lodash = require("lodash");

class ManifestParser {
    constructor(logger, randomName) {
        this.logger = logger;
        this.randomName = randomName;
    }

    async parse(manifestFilePath) {
        this.logger.info(`Parsing manifest '${manifestFilePath}'`);

        const manifestFile = await fs.readFile(manifestFilePath, "utf8");
        const manifest = YAML.parse(manifestFile);

        let template;
        switch (manifest.deploy?.type) {
            case NODEJS_CLI:
                template = new NodeJSCliManifest(this.randomName);
                break;
            default:
                template = new ContainerManifest(this.randomName);
                break;
        }

        const mergedManifest = lodash.merge(template, manifest);
        mergedManifest.validate();

        this.logger.info(`Manifest data: ${JSON.stringify(mergedManifest, null, 2)}`);

        return mergedManifest;
    }
}

module.exports = {
    ManifestParser
}