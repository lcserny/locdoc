import YAML from "yaml";
import fs from "node:fs/promises";
import {NODEJS_CLI, NodeJSCliManifest} from "./nodejs-cli";
import {ContainerManifest} from "./container";
import lodash from "lodash";
import {SYSTEMD, SystemDManifest} from "./systemd";
import type {Logger} from "winston";
import type {Manifest} from "./lib";

export class ManifestParser {
    private logger: Logger;
    private readonly randomName: string;

    constructor(logger: Logger, randomName: string) {
        this.randomName = randomName;
        this.logger = logger;
    }

    async parse(manifestFilePath: string): Promise<Manifest> {
        this.logger.info(`Parsing manifest '${manifestFilePath}'`);

        const manifestFile = await fs.readFile(manifestFilePath, "utf8");
        const manifest = YAML.parse(manifestFile);

        let template: Manifest;
        switch (manifest.deploy?.type) {
            case NODEJS_CLI:
                template = new NodeJSCliManifest(this.randomName);
                break;
            case SYSTEMD:
                template = new SystemDManifest(this.randomName);
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
