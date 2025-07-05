import {createFakeContainer, createFakeDocker, createFakeGit, logger} from "../src/lib/test-util";
import {ContainerDeployer, ContainerManifest} from "../src/lib/container";
import tmp from "tmp-promise";
import path from "node:path";
import fs from "node:fs/promises";

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

            await deployer.createNetwork();

            expect(docker.networkExists).toHaveBeenCalledTimes(1);
            expect(docker.networkExists).toHaveBeenCalledWith(manifest.deploy.networkMode);
            expect(docker.createNetwork).toHaveBeenCalledTimes(1);
            expect(docker.createNetwork).toHaveBeenCalledWith(manifest.deploy.networkMode);

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

            docker.createContainer = jest.fn().mockImplementationOnce(() => {
                return container;
            });

            container.start = jest.fn().mockImplementationOnce(() => {
                return new Promise(() => {});
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
