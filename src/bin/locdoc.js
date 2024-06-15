#!/usr/bin/env node

const {program} = require("commander")
const {ManifestParser} = require("../manifest");
const winston = require("winston");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");
const {DeployRetriever} = require("../deploy");
const {getRandomNumberAsString} = require("../lib");

const { combine, timestamp, prettyPrint, errors } = winston.format;

program
    .name("locdoc")
    .description("CLI to deploy local containers")
    .requiredOption("-m, --manifest <string>", "path to deployment manifest file");

program.parse();

const args = program.opts();

const logger = winston.createLogger({
    level: "info",
    format: combine(errors({stack: true}), timestamp(), prettyPrint()),
    transports: [new winston.transports.Console()]
});

async function main() {
    try {
        const manifestParser = new ManifestParser(logger, getRandomNumberAsString(10000, 99999));
        const manifest = await manifestParser.parse(args.manifest);

        const workDir = path.join(os.tmpdir(), getRandomNumberAsString(10000, 99999))
        logger.info(`Creating workdir '${workDir}'`);

        const deployRetriever = new DeployRetriever(manifest.deploy?.type, workDir, manifest, logger);
        const deployer = deployRetriever.getDeployer();
        await deployer.deploy();

        logger.info(`Removing workdir '${workDir}'`);
        await fs.rm(workDir, {recursive: true});

        logger.info("Done!");
    } catch (e) {
        logger.error(e.stack);
    }
}

main();
