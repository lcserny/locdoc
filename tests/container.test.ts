import { describe, expect, mock, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import tmp from "tmp-promise";
import {ContainerDeployer, type ContainerManifest} from "../src/lib/container";
import {createFakeContainer, createFakeDocker, createFakeGit, logger} from "../src/lib/test-util";

describe("container deployer", () => {
    test("deployer deploys correctly", async () => {
        await tmp.withDir(async (d) => {
            const manifest = {
                image: {
                    name: "img-name",
                    version: "1.0"
                },
                deploy: {
                    name: "cont",
                    type: "container",
                    networkMode: "my-net"
                },
                artifact: {
                    dockerFile: "dkrF",
                }
            };

            const docker = createFakeDocker();
            const deployer = new ContainerDeployer(d.path, manifest as ContainerManifest, logger, docker, createFakeGit());

            const baseName = "myRepo";
            const artifactRepoDir = path.join(d.path, baseName)
            fs.mkdirSync(artifactRepoDir, {recursive: true});

            const dockerImage = await deployer.buildImage(artifactRepoDir);

            expect(docker.buildImage).toHaveBeenCalledTimes(1);
            expect(docker.buildImage).toHaveBeenCalledWith(
                expect.stringMatching(dockerImage),
                expect.stringMatching(manifest.artifact.dockerFile),
                expect.stringContaining(baseName)
            );

            await deployer.createNetwork();

            expect(docker.networkExists).toHaveBeenCalledTimes(1);
            expect(docker.networkExists).toHaveBeenCalledWith(manifest.deploy.networkMode);
            expect(docker.createNetwork).toHaveBeenCalledTimes(1);
            expect(docker.createNetwork).toHaveBeenCalledWith(manifest.deploy.networkMode);

            let getContainerCalls = 0;
            const container = createFakeContainer();
            docker.getContainer = mock(async () => {
                if (getContainerCalls++ === 0) {
                    return container;
                }
                throw Error("getContainer() failed");
            });
            let getStatusCalls = 0;
            container.getStatus = mock(async () => {
                if (getStatusCalls++ === 0) {
                    return "up";
                }
                throw Error("getStatus() failed");
            });

            await deployer.cleanExistingContainer(manifest.deploy.name);

            expect(docker.getContainer).toHaveBeenCalledTimes(1);
            expect(docker.getContainer).toHaveBeenCalledWith(manifest.deploy.name);
            expect(container.getStatus).toHaveBeenCalledTimes(1);
            expect(container.stop).toHaveBeenCalledTimes(1);
            expect(container.remove).toHaveBeenCalledTimes(1);

            let createContainerCalls = 0;
            docker.createContainer = mock(async () => {
                if (createContainerCalls++ === 0) {
                    return container;
                }
                throw Error("createContainer() failed");
            });

            let startCalls = 0;
            container.start = mock(async () => {
                if (startCalls++ === 0) {
                    return;
                }
                throw Error("start() failed");
            });

            await deployer.createContainer(artifactRepoDir, manifest.deploy, dockerImage);

            expect(docker.createContainer).toHaveBeenCalledTimes(1);
            expect(docker.createContainer).toHaveBeenCalledWith(
                expect.stringContaining(dockerImage),
                expect.objectContaining(manifest.deploy)
            );
            expect(container.start).toHaveBeenCalledTimes(1);

            await deployer.cleanupBuild();

            expect(docker.cleanup).toHaveBeenCalledTimes(1);
        }, {unsafeCleanup: true});
    });
});
