#!/usr/bin/env node
import 'zx/globals'
import * as argparse from "argparse";
import * as tracer from "tracer";
import { ManifestParser } from '../manifest.js';

const parser = new argparse.ArgumentParser({
    description: "Local Docker Deployer"
});
parser.add_argument("-m", "--manifest", { required: true, help: "path to deployment manifest file" });
const args = parser.parse_args();

const logger = tracer.colorConsole();

try {
    const manifestParser = new ManifestParser(logger);
    const manifest = await manifestParser.parse(args.manifest); 

    const workDir = await $`echo -n /tmp/$RANDOM`;

    const artifactRepoDir = await $`echo -n ${workDir}/${manifest.image.name}`;
    await $`mkdir -p ${artifactRepoDir}`;
    await $`cd ${artifactRepoDir} && git clone --branch ${manifest.artifact.tag} ${manifest.artifact.repo} .`;

    const configRepoDir = `${artifactRepoDir}/${manifest.config.destinationPath}`;
    await $`mkdir -p ${configRepoDir}`;
    const tmpConfigRepoDir = await $`echo -n ${workDir}/$RANDOM`;
    await $`mkdir -p ${tmpConfigRepoDir}`;
    await $`cd ${tmpConfigRepoDir} && git clone --branch ${manifest.config.tag} ${manifest.config.repo} .`;
    await $`mv ${tmpConfigRepoDir}/* ${configRepoDir}`;

    await $`cd ${artifactRepoDir} && bash -c ${manifest.artifact.buildCmd}`;

    const dockerImage = `${manifest.image.name}:${manifest.image.version}`;
    const dockerFilePath = path.join(artifactRepoDir.toString(), manifest.artifact.dockerFile);
    // TODO: if same image with tag exists, get its ID, at the end delete it
    await $`docker build -t ${dockerImage} -f ${dockerFilePath} ${artifactRepoDir}`;

    const networkName = manifest.deploy.network;
    if (networkName) {
        const dockerNetResp = await $`docker network ls --filter name=${networkName} --format {{.Name}}`;
        if (!dockerNetResp.stdout) {
            await $`docker network create ${networkName}`;
        }
    }

    const containerName = manifest.deploy.name;
    const dockerContResp = await $`docker container ls -a --filter name=${containerName} --format {{.ID}}:{{.State}}`;
    if (dockerContResp.stdout) {
        const split = dockerContResp.toString().split(":");
        const containerId = split[0];
        const containerState = split[1].replace(/(\r\n|\n|\r)/gm,"");
        if (containerState === "running") {
            await $`docker container stop ${containerId}`;
        }
        await $`docker container rm ${containerId}`;
    }

    let runFlags = manifest.deploy.runFlags;
    if (!runFlags.includes("--network")) {
        runFlags += " --network " + manifest.deploy.network;
    }

    const dockerRunArgs = ['-d', ...runFlags.split(' '), '--name', containerName, manifest.image.name + ':' + manifest.image.version];
    await $`docker run ${dockerRunArgs}`;

    await $`docker builder prune -f`;

    await $`rm -rf ${workDir}`;

    logger.info("Done!");
} catch (error) {
    let cause = "<unavailable>";
    if (error.cause) {
        cause = `${error.cause}`;
    }
    // logger.error(`${error.message}\n\tCause: ${cause}`);
    logger.error(`${error.message}`);
}
