#!/usr/bin/env node
import {execa} from "execa";
import * as argparse from "argparse";
import * as tracer from "tracer";
import { ManifestParser } from '../manifest.js';
import path from 'path';

const parser = new argparse.ArgumentParser({
    description: "Local Docker Deployer"
});
parser.add_argument("-m", "--manifest", { required: true, help: "path to deployment manifest file" });
const args = parser.parse_args();

const logger = tracer.colorConsole();

try {
    const manifestParser = new ManifestParser(logger);
    const manifest = await manifestParser.parse(args.manifest); 

    const workDir = await execa(`echo`, ["-n", "/tmp/$RANDOM"]);

    const artifactRepoDir = await execa(`echo`, ["-n", `${workDir}/${manifest.image.name}`]);
    await execa(`mkdir`, ["-p", artifactRepoDir.stdout]);
    await execa(`cd`, [artifactRepoDir, "&&", "git", "clone", "--branch", manifest.artifact.tag, manifest.artifact.repo, `.`]);

    const configRepoDir = `${artifactRepoDir}/${manifest.config.destinationPath}`;
    await execa(`mkdir`, ["-p", configRepoDir]);
    const tmpConfigRepoDir = await execa(`echo`, ["-n", `${workDir}/$RANDOM`]);
    await execa(`mkdir`, ["-p", tmpConfigRepoDir.stdout]);
    await execa(`cd`, [tmpConfigRepoDir, "&&", "git", "clone", "--branch", manifest.config.tag, manifest.config.repo, "."]);
    await execa(`mv`, [tmpConfigRepoDir.stdout, configRepoDir]);

    await execa(`cd`, [artifactRepoDir, "&&", "bash", "-c", manifest.artifact.buildCmd]);

    const dockerImage = `${manifest.image.name}:${manifest.image.version}`;
    const dockerFilePath = path.join(artifactRepoDir.toString(), manifest.artifact.dockerFile);
    // TODO: if same image with tag exists, get its ID, at the end delete it
    await execa(`docker`, ["build", "-t", dockerImage, "-f", dockerFilePath, artifactRepoDir.stdout]);

    const networkName = manifest.deploy.network;
    if (networkName) {
        const dockerNetResp = await execa(`docker`, ["network", "ls", "--filter", `name=${networkName}`, "--format", "{{.Name}}"]);
        if (!dockerNetResp.stdout) {
            await execa(`docker`, ["network", "create", networkName]);
        }
    }

    const containerName = manifest.deploy.name;
    const dockerContResp = await execa(`docker`, ["container", "ls", "-a", "--filter", `name=${containerName}`, "--format", "{{.ID}}:{{.State}}"]);
    if (dockerContResp.stdout) {
        const split = dockerContResp.toString().split(":");
        const containerId = split[0];
        const containerState = split[1].replace(/(\r\n|\n|\r)/gm,"");
        if (containerState === "running") {
            await execa(`docker`, ["container", "stop", containerId]);
        }
        await execa(`docker`, ["container", "rm", containerId]);
    }

    let runFlags = manifest.deploy.runFlags;
    if (!runFlags.includes("--network")) {
        runFlags += " --network " + manifest.deploy.network;
    }
    // FIXME: runFlags something is wrong quoted???
    // --restart unless-stopped -p 7090:8080 -v /mnt/d:/data
    // network: "vm-network"
    // nothing works.........
    await execa(`docker`, ["run", "-d", runFlags, "--name", containerName, `${manifest.image.name}:${manifest.image.version}`]);

    await execa(`docker`, ["builder", "prune", "-f"]);

    await execa(`rm`, ["-rf", workDir.stdout]);

    logger.info("Done!");
} catch (error) {
    let cause = "<unavailable>";
    if (error.cause) {
        cause = `${error.cause}`;
    }
    // logger.error(`${error.message}\n\tCause: ${cause}`);
    logger.error(`${error.message}`);
}
