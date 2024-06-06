import * as fs from "node:fs/promises";
import YAML from "yaml";
import lodash from "lodash-es";

export class ManifestParser {
    constructor(logger, randomName) {
        this.logger = logger;
        this.randomName = randomName;
    }

    async parse(manifestFilePath) {
        this.logger.info(`Parsing manifest '${manifestFilePath}'`);

        const manifestFile = await fs.readFile(manifestFilePath, "utf8");
        const template = new Manifest(this.randomName);
        const manifest = YAML.parse(manifestFile);

        const mergedManifest = lodash.merge(template, manifest);
        this.validate(mergedManifest);

        this.logger.info(`Manifest data: ${JSON.stringify(mergedManifest)}`);

        return mergedManifest;
    }

    validate(manifest) {
        if (manifest.artifact?.repo == null) {
            throw new Error("manifest provided has no `artifact.repo`");
        }

        if (manifest.artifact?.buildCmd == null) {
            throw new Error("manifest provided has no `artifact.buildCmd`");
        }

        if (manifest.config?.repo == null) {
            throw new Error("manifest provided has no `config.repo`");
        }

        if (manifest.config?.destinationPath == null) {
            throw new Error("manifest provided has no `config.destinationPath`");
        }
    }
}

export class Manifest {
    name;
    artifact = { repo: null, tag: "master", dockerFile: "Dockerfile", buildCmd: null };
    config = { repo: null, tag: "master", destinationPath: null };
    image = { name: "", version: "1.0" };
    deploy = { type: "container", name: "", network: undefined, runFlags: undefined };

    constructor(randomName) {
        this.name = randomName;
        this.deploy.name = this.name;
        this.image.name = this.name + "-image";
    }
}
