#!/usr/bin/env node

import * as argparse from "argparse";
import * as tracer from "tracer";
import { ManifestParser } from "../manifest.js";
import { createWorkDir, removeWorkDir } from "../fs.js";
import { GitHandler } from "../git.js";
import { retrieveDeployHandler } from "../deploy.js";
import { runCmd } from "../exec.js";

const logger = tracer.colorConsole();

const parser = new argparse.ArgumentParser({
    description: "Local Docker Deployer"
});
parser.add_argument("-m", "--manifest", { required: true, help: "path to deployment manifest file" });
const args = parser.parse_args();

const manifestParser = new ManifestParser(logger);
const manifest = await manifestParser.parse(args.manifest); 

const workDir = await createWorkDir();

const gitHandler = new GitHandler(logger);
const artifactRepoDir = await gitHandler.cloneArtifact(manifest, workDir);
const configRepoDir = await gitHandler.cloneConfig(manifest, workDir, artifactRepoDir);

logger.info(`Building artifact`);
await runCmd(`cd ${artifactRepoDir} && ${manifest.artifact.buildCmd}`);

const deployHandler = retrieveDeployHandler(logger, manifest, artifactRepoDir);
await deployHandler.build();
await deployHandler.config();
await deployHandler.start();
await deployHandler.clean();

await removeWorkDir(workDir);

// TODO: impl -v flag for verbose output

// TODO: wrapper all errors
// https://medium.com/@vickypaiyaa/power-of-advanced-error-handling-techniques-in-node-js-44d53cda3c61

logger.info("Done!");
