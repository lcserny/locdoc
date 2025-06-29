#!/usr/bin/env node

import {program} from "commander";
import {ManifestParser} from "./lib/manifest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {DeployRetriever} from "./lib/deploy";
import {createLogger, getRandomNumberAsString} from "./lib/lib";
import ora from "ora";

program
    .name("locdoc")
    .description("CLI to deploy local containers")
    .requiredOption("-m, --manifest <string>", "path to deployment manifest file")
    .option("-j, --json", "use JSON logging format");

program.parse();

const args = program.opts();

const spinner = ora("Processing...");
const logger = createLogger(args, spinner);

// TODO: deploy type alternative to sysmteD but for windows?

async function main() {
    try {
        spinner.start();

        const manifestParser = new ManifestParser(logger, getRandomNumberAsString(10000, 99999));
        const manifest = await manifestParser.parse(args.manifest);

        const workDir = path.join(os.homedir(), "tmp", getRandomNumberAsString(10000, 99999))
        logger.info(`Creating workdir '${workDir}'`);

        const deployRetriever = new DeployRetriever(manifest.deploy?.type, workDir, manifest, logger);
        const deployer = deployRetriever.getDeployer();
        await deployer.deploy();

        logger.info(`Removing workdir '${workDir}'`);
        await fs.rm(workDir, {recursive: true});

        spinner.succeed(" Done!");
    } catch (e: unknown) {
        const error = e as Error;
        logger.error(error.stack);
        spinner.fail(" Error!");
    }
}

main();