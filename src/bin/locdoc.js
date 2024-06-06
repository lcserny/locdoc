#!/usr/bin/env node

import * as argparse from "argparse";
import * as tracer from "tracer";
import {ManifestParser} from '../manifest.js';
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs/promises";
import simpleGit from "simple-git";
import * as child_process from "node:child_process";
import * as util from "node:util";
import {Docker} from "docker-cli-js";

const parser = new argparse.ArgumentParser({
    description: "Local Docker Deployer"
});
parser.add_argument("-m", "--manifest", {required: true, help: "path to deployment manifest file"});
const args = parser.parse_args();

const docker = new Docker({echo: false});
const exec = util.promisify(child_process.exec);
const git = simpleGit();
const logger = tracer.colorConsole();

try {
    const manifestParser = new ManifestParser(logger, getRandomNumberAsString(10000, 99999));
    const manifest = await manifestParser.parse(args.manifest);

    const workDir = path.join(os.tmpdir(), getRandomNumberAsString(10000, 99999))
    logger.info(`Creating workdir '${workDir}'`);

    logger.info(`Cloning artifact repo`);
    const artifactRepoDir = path.join(workDir, manifest.image.name);
    await fs.mkdir(artifactRepoDir, {recursive: true});
    await git.clone(manifest.artifact.repo, artifactRepoDir, {"--branch": manifest.artifact.tag});

    const configRepoDir = path.join(artifactRepoDir, manifest.config.destinationPath);
    await fs.mkdir(configRepoDir, {recursive: true});

    logger.info("Cloning config repo");
    const tmpConfigRepoDir = path.join(workDir, getRandomNumberAsString(10000, 99999));
    await fs.mkdir(tmpConfigRepoDir, {recursive: true});
    await git.clone(manifest.config.repo, tmpConfigRepoDir, {"--branch": manifest.config.tag});

    logger.info("Merging config in artifact");
    await fs.readdir(tmpConfigRepoDir).then(files => {
        files.forEach((file) => {
            fs.rename(path.join(tmpConfigRepoDir, file), path.join(configRepoDir, file));
        });
    });

    logger.info("Executing build command");
    process.chdir(artifactRepoDir);
    await exec(`bash -c '${manifest.artifact.buildCmd}'`);

    logger.info("Building Docker image");
    const dockerImage = `${manifest.image.name}:${manifest.image.version}`;
    const dockerFilePath = path.join(artifactRepoDir, manifest.artifact.dockerFile);
    await docker.command(`build -t ${dockerImage} -f ${dockerFilePath} ${artifactRepoDir}`);

    const dockerNet = manifest.deploy.network;
    if (dockerNet) {
        const networksResp = await docker.command(`network ls --filter name=${dockerNet}`);
        if (networksResp.network.length === 0) {
            logger.info(`Docker network '${dockerNet}' not found, creating...`);
            await docker.command(`network create ${dockerNet}`);
        }
    }

    const dockerContainer = manifest.deploy.name;
    const containersResp = await docker.command(`ps -a --filter name=${dockerContainer}`);
    if (containersResp.containerList.length > 0) {
        const container = containersResp.containerList[0];
        const containerId = container["container id"];
        logger.info(`Existing container found '${containerId}'`);
        const containerStatus = container.status;
        if (containerStatus.toLowerCase().includes("up")) {
            logger.info(`Stopping container '${dockerContainer}'`);
            await docker.command(`stop ${dockerContainer}`);
        }
        logger.info(`Removing existing container '${dockerContainer}'`);
        await docker.command(`rm -v ${dockerContainer}`);
    }

    let runFlags = manifest.deploy.runFlags;
    if (!runFlags.includes("--network")) {
        runFlags += ` --network ${dockerNet}`;
    }
    logger.info(`Starting new docker container '${dockerContainer}'`);
    await docker.command(`run -d ${runFlags} --name ${dockerContainer} ${dockerImage}`);

    await docker.command(`builder prune -f`);

    await fs.rm(workDir, {recursive: true});

    logger.info("Done!");
} catch (e) {
    logger.error(e);
}

function getRandomNumberAsString(min, max) {
    return Math.floor(Math.random() * (max - min) + min).toString();
}
