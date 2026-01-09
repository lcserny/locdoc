import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import tmp from "tmp-promise";
import {BaseDeployer} from "../src/api/deploy";
import {CONTAINER, ContainerDeployer, ContainerManifest} from "../src/lib/container";
import {DeployRetriever} from "../src/lib/deploy";
import type {ManifestType} from "../src/lib/manifest";
import {NODEJS_CLI, NodeJSCliDeployer, NodeJSCliManifest} from "../src/lib/nodejs-cli";
import {SYSTEMD, SystemDDeployer, SystemDManifest} from "../src/lib/systemd";
import {createFakeDocker, createFakeGit, logger} from "../src/lib/test-util";

describe("deployRetriever", () => {
    test("retriever produces container deployer", async () => {
        const retriever = new DeployRetriever(CONTAINER, "", new ContainerManifest("a"), logger, createFakeGit(), createFakeDocker());
        const deployer = retriever.getDeployer();

        expect(deployer instanceof ContainerDeployer).toBeTruthy();
    });

    test("retriever produces nodejs-cli deployer", async () => {
        const retriever = new DeployRetriever(NODEJS_CLI, "", new NodeJSCliManifest("b"), logger, createFakeGit(), createFakeDocker());
        const deployer = retriever.getDeployer();

        expect(deployer instanceof NodeJSCliDeployer).toBeTruthy();
    });

    test("retriever produces systemd deployer", async () => {
        if (os.platform() === "win32") {
            return;
        }

        const retriever = new DeployRetriever(SYSTEMD, "", new SystemDManifest("c"), logger, createFakeGit(), createFakeDocker());
        const deployer = retriever.getDeployer();

        expect(deployer instanceof SystemDDeployer).toBeTruthy();
    });

    test("base deployer can clone artifact", async () => {
        await tmp.withDir(async (d) => {
            const manifest = {
                deploy: {
                    name: "someName"
                },
                artifact: {
                    repo: "someRepo",
                    tag: "helloBranch"
                }
            };
            const git = createFakeGit();
            const deployer = new BaseDeployer(logger, d.path, manifest as ManifestType, git);

            const artifactRepoDir = await deployer.cloneArtifactRepo();

            const ardRegex = new RegExp(`^.*${manifest.deploy.name}`);
            expect(git.clone).toHaveBeenCalledTimes(1);
            expect(git.clone).toHaveBeenCalledWith(manifest.artifact.repo, expect.stringMatching(ardRegex), manifest.artifact.tag);
            expect(artifactRepoDir).toMatch(ardRegex);
        }, {unsafeCleanup: true});
    });

    test("base deployer can clone config", async () => {
        await tmp.withDir(async (d) => {
            const manifest = {
                deploy: {
                    name: "someConfig"
                },
                config: {
                    repo: "someConfigRepo",
                    tag: "cfg-branch",
                    destinationPath: path.join("my", "path")
                }
            };

            const git = createFakeGit();
            const deployer = new BaseDeployer(logger, d.path, manifest as ManifestType, git);
            const artifactRepoDir = path.join(d.path, manifest.deploy.name);

            const configRepoDir = await deployer.cloneConfigRepo(artifactRepoDir);

            expect(git.clone).toHaveBeenCalledTimes(1);
            expect(git.clone).toHaveBeenCalledWith(manifest.config.repo, expect.any(String), manifest.config.tag);
            expect(configRepoDir).toContain(manifest.deploy.name);
            expect(configRepoDir).toContain(manifest.config.destinationPath);
        }, {unsafeCleanup: true});
    });

    test("base deployer can execute build cmd", async () => {
        await tmp.withDir(async (d) => {
            const artifactRepoDir = d.path;
            const cmdPath = "touchedTestFiled";
            const manifest = { artifact: { buildCmd: `touch ${cmdPath}` } };
            const deployer = new BaseDeployer(logger, d.path, manifest as ManifestType, createFakeGit());

            await deployer.executeBuildCommand(artifactRepoDir);

            expect(fs.existsSync(path.join(artifactRepoDir, cmdPath))).toBeTruthy();
        }, {unsafeCleanup: true});
    });
});