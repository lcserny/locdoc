#!/usr/bin/env node

const {program} = require("commander")
const {ManifestParser} = require("../manifest");
const winston = require("winston");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");
const {DeployRetriever} = require("../deploy");
const {getRandomNumberAsString} = require("../lib");

const { combine, timestamp, prettyPrint, printf, errors } = winston.format;

program
    .name("locdoc")
    .description("CLI to deploy local containers")
    .requiredOption("-m, --manifest <string>", "path to deployment manifest file")
    .option("-j, --json", "use JSON logging format");

program.parse();

const args = program.opts();

const logger = winston.createLogger({
    level: "info",
    format: combine(errors({stack: true}), timestamp(), args.json
        ? prettyPrint()
        : printf(({timestamp, level, message, stack}) => {
            const text = `${timestamp} ${level.toUpperCase()} ${message}`;
            return stack ? text + '\n' + stack : text;
        })),
    transports: [new winston.transports.Console()]
});

async function main() {
    try {
        if (os.platform() === 'win32') {
            logger.error("Windows is not supported");
            return;
        }

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
