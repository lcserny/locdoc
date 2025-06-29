import {DeployRetriever} from "../src/lib/deploy";
import {createFakeGit, logger} from "../src/lib/test-util";
import {CONTAINER, ContainerDeployer, ContainerManifest} from "../src/lib/container";
import {NODEJS_CLI, NodeJSCliDeployer, NodeJSCliManifest} from "../src/lib/nodejs-cli";
import type { Manifest} from "../src/lib/lib";
import {BaseDeployer} from "../src/lib/lib";
import path from "node:path";
import fse from "fs-extra";
import tmp from "tmp-promise";
import {SYSTEMD, SystemDDeployer, SystemDManifest} from "../src/lib/systemd";
import os from "node:os";

describe("deployRetriever", () => {
    test("retriever produces container deployer", async () => {
        const retriever = new DeployRetriever(CONTAINER, "", new ContainerManifest("a"), logger);
        const deployer = retriever.getDeployer();

        expect(deployer instanceof ContainerDeployer).toBeTruthy();
    });

    test("retriever produces nodejs-cli deployer", async () => {
        const retriever = new DeployRetriever(NODEJS_CLI, "", new NodeJSCliManifest("b"), logger);
        const deployer = retriever.getDeployer();

        expect(deployer instanceof NodeJSCliDeployer).toBeTruthy();
    });

    test("retriever produces systemd deployer", async () => {
        if (os.platform() === "win32") {
            return;
        }

        const retriever = new DeployRetriever(SYSTEMD, "", new SystemDManifest("c"), logger);
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
            const deployer = new BaseDeployer(logger, d.path, manifest as Manifest, git);

            const artifactRepoDir = await deployer.cloneArtifactRepo();

            const ardRegex = new RegExp(String.raw`^.*${manifest.deploy.name}`, "g");
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
            const deployer = new BaseDeployer(logger, d.path, manifest as Manifest, git);
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
            const deployer = new BaseDeployer(logger, d.path, manifest as Manifest, createFakeGit());

            await deployer.executeBuildCommand(artifactRepoDir);

            expect(await fse.pathExists(path.join(artifactRepoDir, cmdPath))).toBeTruthy();
        }, {unsafeCleanup: true});
    });
});