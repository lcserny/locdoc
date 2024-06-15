#!/usr/bin/env node

import {program} from "commander";
import * as winston from "winston";
import {ManifestParser} from '../manifest.js';
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs/promises";
import {ContainerDeployer} from "../container.js";
import {NodeCliDeployer} from "../nodecli.js";
import {getRandomNumberAsString} from "../util.js";

const {format, createLogger, transports} = winston.default;
const {timestamp, combine, errors, prettyPrint} = format;

program
    .name("locdoc")
    .description("CLI to deploy local containers")
    .requiredOption("-m, --manifest <string>", "path to deployment manifest file");

program.parse();

const args = program.opts();

const logger = createLogger({
    level: "info",
    format: combine(errors({stack: true}), timestamp(), prettyPrint()),
    transports: [new transports.Console()]
});

try {
    const manifestParser = new ManifestParser(logger, getRandomNumberAsString(10000, 99999));
    const manifest = await manifestParser.parse(args.manifest);

    const workDir = path.join(os.tmpdir(), getRandomNumberAsString(10000, 99999))
    logger.info(`Creating workdir '${workDir}'`);

    // TODO: not ok here, should be switch used once
    let deployer;
    switch (manifest.deploy?.type) {
        case "nodecli":
            deployer = new NodeCliDeployer(workDir, manifest, logger);
            break;
        default:
            deployer = new ContainerDeployer(workDir, manifest, logger);
            break;
    }

    await deployer.deploy();

    logger.info(`Removing workdir '${workDir}'`);
    await fs.rm(workDir, {recursive: true});

    logger.info("Done!");
} catch (e) {
    logger.error(e.stack);
}
