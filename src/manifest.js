import * as fs from "node:fs/promises";
import YAML from "yaml";
import lodash from "lodash-es";
import {NodeCliManifest} from "./nodecli.js";
import {ContainerManifest} from "./container.js";

// FIXME: Cannot access 'BaseManifest' before initialization, try commonJS requires?
export class BaseManifest {
    constructor(randomName) {
        this.name = randomName
    }

    validate() {
        throw new Error("not implemented");
    }
}

export class ManifestParser {
    constructor(logger, randomName) {
        this.logger = logger;
        this.randomName = randomName;
    }

    async parse(manifestFilePath) {
        this.logger.info(`Parsing manifest '${manifestFilePath}'`);

        const manifestFile = await fs.readFile(manifestFilePath, "utf8");
        const manifest = YAML.parse(manifestFile);

        let template;
        switch (manifest.deploy.type) {
            case "nodecli":
                template = new NodeCliManifest(this.randomName);
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

