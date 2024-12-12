import {createFakeDocker, createFakeGit, logger} from "../src/test-util";
import {ContainerDeployer} from "../src/container";
import tmp from "tmp-promise";
import path from "node:path";
import fs from "node:fs/promises";
import type {Manifest} from "../src/lib";

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

            expect(docker.command).toBeCalledTimes(1);
            const dkrRegex = new RegExp(String.raw`^build -t ${dockerImage}.*${manifest.artifact.dockerFile}.*${artifactRepoDir}`, "g");
            expect(docker.command).toBeCalledWith(expect.stringMatching(dkrRegex));

            let createdNetwork = false;
            docker.command = jest.fn()
                .mockImplementationOnce((cmd) => {
                    if (cmd.includes("network ls")) {
                        return {network: ""};
                    }
                })
                .mockImplementationOnce((cmd) => {
                    if (cmd.includes("network create")) {
                        createdNetwork = true;
                    }
                });

            const dockerNet = await deployer.createNetwork();

            expect(dockerNet).toBe(manifest.deploy.network);
            expect(docker.command).toBeCalledTimes(2);
            expect(createdNetwork).toBeTruthy();

            let stoppedContainer = false;
            let removedContainer = false;
            docker.command = jest.fn()
                .mockImplementationOnce((cmd) => {
                    if (cmd.includes("ps -a --filter")) {
                        return { containerList: [{
                            "container id": "irrelevant",
                            status: "up"
                        }] };
                    }
                })
                .mockImplementationOnce((cmd) => {
                    if (cmd.includes("stop")) {
                        stoppedContainer = true;
                    }
                })
                .mockImplementationOnce((cmd) => {
                    if (cmd.includes("rm -v")) {
                        removedContainer = true;
                    }
                });

            await deployer.cleanExistingContainer(manifest.deploy.name);

            expect(stoppedContainer).toBeTruthy();
            expect(removedContainer).toBeTruthy();
            expect(docker.command).toBeCalledTimes(3);

            expect(manifest.deploy.runFlags).not.toContain(dockerNet);
            const flags = deployer.ensureNetwork(dockerNet);
            expect(flags).toContain(dockerNet);

            let createdContainer = false;
            docker.command = jest.fn().mockImplementationOnce((cmd) => {
                    if (cmd.includes("run -d")) {
                        createdContainer = true;
                    }
                });

            await deployer.createContainer(manifest.deploy.name, flags, dockerImage);

            expect(docker.command).toBeCalledTimes(1);
            expect(createdContainer).toBeTruthy();

            let cleanedDockerImages = false;
            let cleanedDockerSystem = false;
            let cleanedDockerBuilder = false;
            docker.command = jest.fn()
                .mockImplementationOnce((cmd) => {
                    if (cmd.includes("image prune -af")) {
                        cleanedDockerImages = true
                    }
                })
                .mockImplementationOnce((cmd) => {
                    if (cmd.includes("system prune -af")) {
                        cleanedDockerSystem = true;
                    }
                })
                .mockImplementationOnce((cmd) => {
                    if (cmd.includes("builder prune -af")) {
                        cleanedDockerBuilder = true;
                    }
                })

            await deployer.cleanupBuild();

            expect(docker.command).toBeCalledTimes(3);
            expect(cleanedDockerImages).toBeTruthy();
            expect(cleanedDockerSystem).toBeTruthy();
            expect(cleanedDockerBuilder).toBeTruthy();
        }, {unsafeCleanup: true});
    });
});