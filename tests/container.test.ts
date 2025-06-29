import {createFakeContainer, createFakeDocker, createFakeGit, logger} from "../src/lib/test-util";
import {ContainerDeployer} from "../src/lib/container";
import tmp from "tmp-promise";
import path from "node:path";
import fs from "node:fs/promises";
import type {Manifest} from "../src/lib/lib";

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
                    network: "my-net",
                    runFlags: "something"
                },
                artifact: {
                    dockerFile: "dkrF"
                }
            };

            const docker = createFakeDocker();
            const deployer = new ContainerDeployer(d.path, manifest as Manifest, logger, docker, createFakeGit());

            const baseName = "myRepo";
            const artifactRepoDir = path.join(d.path, baseName)
            await fs.mkdir(artifactRepoDir, {recursive: true});

            const dockerImage = await deployer.buildImage(artifactRepoDir);

            expect(docker.buildImage).toHaveBeenCalledTimes(1);
            expect(docker.buildImage).toHaveBeenCalledWith(
                expect.stringMatching(dockerImage),
                expect.arrayContaining([
                    expect.stringMatching("."),
                    expect.stringMatching(manifest.artifact.dockerFile),
                ]),
                expect.stringContaining(baseName)
            );

            const dockerNet = await deployer.createNetwork();

            expect(dockerNet).toBe(manifest.deploy.network);
            expect(docker.networkExists).toHaveBeenCalledTimes(1);
            expect(docker.networkExists).toHaveBeenCalledWith(manifest.deploy.network);
            expect(docker.createNetwork).toHaveBeenCalledTimes(1);
            expect(docker.createNetwork).toHaveBeenCalledWith(manifest.deploy.network);

            const container = createFakeContainer();
            docker.getContainer = jest.fn().mockImplementationOnce(() => {
                return container;
            });
            container.getStatus = jest.fn().mockImplementationOnce(() => {
                return "up";
            });

            await deployer.cleanExistingContainer(manifest.deploy.name);

            expect(docker.getContainer).toHaveBeenCalledTimes(1);
            expect(docker.getContainer).toHaveBeenCalledWith(manifest.deploy.name);
            expect(container.getStatus).toHaveBeenCalledTimes(1);
            expect(container.stop).toHaveBeenCalledTimes(1);
            expect(container.remove).toHaveBeenCalledTimes(1);

            expect(manifest.deploy.runFlags).not.toContain(dockerNet);
            const flags = deployer.ensureNetwork(dockerNet);
            expect(flags).toContain(dockerNet);

            docker.createContainer = jest.fn().mockImplementationOnce(() => {
                return container;
            });

            container.start = jest.fn().mockImplementationOnce(() => {
                return new Promise(() => {});
            });

            await deployer.createContainer(artifactRepoDir, manifest.deploy.name, flags, dockerImage);

            expect(docker.createContainer).toHaveBeenCalledTimes(1);
            expect(docker.createContainer).toHaveBeenCalledWith(
                expect.stringContaining(manifest.deploy.name),
                expect.stringContaining(dockerImage),
                expect.stringContaining(flags)
            );
            expect(container.start).toHaveBeenCalledTimes(1);

            await deployer.cleanupBuild();

            expect(docker.cleanup).toHaveBeenCalledTimes(1);
        }, {unsafeCleanup: true});
    });
});
