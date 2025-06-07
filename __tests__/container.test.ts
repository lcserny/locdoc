import {createFakeDocker, createFakeGit, logger} from "../src/test-util";
import {ContainerDeployer, ContainerOptionsParser} from "../src/container";
import tmp from "tmp-promise";
import path from "node:path";
import fs from "node:fs/promises";
import type {Manifest} from "../src/lib";

describe("container deployer", () => {
    // FIXME
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

            expect(docker.command).toHaveBeenCalledTimes(1);
            const dkrRegex = new RegExp(String.raw`^build -t ${dockerImage}.*${manifest.artifact.dockerFile}.*${baseName}`, "g");
            expect(docker.command).toHaveBeenCalledWith(expect.stringMatching(dkrRegex));

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
            expect(docker.command).toHaveBeenCalledTimes(2);
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
            expect(docker.command).toHaveBeenCalledTimes(3);

            expect(manifest.deploy.runFlags).not.toContain(dockerNet);
            const flags = deployer.ensureNetwork(dockerNet);
            expect(flags).toContain(dockerNet);

            let createdContainer = false;
            docker.command = jest.fn().mockImplementationOnce((cmd) => {
                    if (cmd.includes("run -d")) {
                        createdContainer = true;
                    }
                });

            await deployer.createContainer(artifactRepoDir, manifest.deploy.name, flags, dockerImage);

            expect(docker.command).toHaveBeenCalledTimes(1);
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

            expect(docker.command).toHaveBeenCalledTimes(3);
            expect(cleanedDockerImages).toBeTruthy();
            expect(cleanedDockerSystem).toBeTruthy();
            expect(cleanedDockerBuilder).toBeTruthy();
        }, {unsafeCleanup: true});
    });
});

describe("container parser", () => {
    test("can parse --env-file", async () => {
        await tmp.withFile(async (f) => {
            await fs.writeFile(f.path, "FOO=bar\nBAZ=qux");

            const parser = new ContainerOptionsParser();
            const options = parser.parseRunOptions("contName", "imgName", `--env-file=${f.path}`);

            expect(options.Env).toEqual(["FOO=bar", "BAZ=qux"]);
        }, {postfix: ".tmp"});
    });

    test("can parse --memory", () => {
        const parser = new ContainerOptionsParser();

        let options = parser.parseRunOptions("contName", "imgName", `--memory=512m`);
        expect(options.HostConfig?.Memory).toEqual(512 * 1024 * 1024);

        options = parser.parseRunOptions("contName", "imgName", `--memory=5g`);
        expect(options.HostConfig?.Memory).toEqual(5 * 1024 * 1024 * 1024);
    });

    test("can parse --restart", () => {
        const parser = new ContainerOptionsParser();

        let options = parser.parseRunOptions("contName", "imgName", `--restart=always`);
        expect(options.HostConfig?.RestartPolicy?.Name).toEqual("always");

        options = parser.parseRunOptions("contName", "imgName", `--restart="always"`);
        expect(options.HostConfig?.RestartPolicy?.Name).toEqual("always");
    });

    test("can parse --add-host", () => {
        const parser = new ContainerOptionsParser();

        let options = parser.parseRunOptions("contName", "imgName", `--add-host=leo:somewhere`);
        expect(options.HostConfig?.ExtraHosts?.length).toEqual(1);
        expect(options.HostConfig?.ExtraHosts[0]).toEqual("leo:somewhere");

        options = parser.parseRunOptions("contName", "imgName", `--add-host="leo:somewhere"`);
        expect(options.HostConfig?.ExtraHosts?.length).toEqual(1);
        expect(options.HostConfig?.ExtraHosts[0]).toEqual("leo:somewhere");
    });

    test("can parse --volume", () => {
        const parser = new ContainerOptionsParser();

        let options = parser.parseRunOptions("contName", "imgName", `--volume=/host/path:/container/path`);
        expect(options.HostConfig?.Binds?.length).toEqual(1);
        expect(options.HostConfig?.Binds?.[0]).toEqual("/host/path:/container/path");

        options = parser.parseRunOptions("contName", "imgName", `--volume="/host/path:/container/path"`);
        expect(options.HostConfig?.Binds?.length).toEqual(1);
        expect(options.HostConfig?.Binds?.[0]).toEqual("/host/path:/container/path");
    });

    test("can parse --publish", () => {
        const parser = new ContainerOptionsParser();

        const options = parser.parseRunOptions("contName", "imgName", `--publish=10030:80`);
        expect(options.ExposedPorts?.["80"]).toEqual({});
        expect(options.HostConfig?.PortBindings?.["80"]).toEqual([
            {
                HostIp: "0.0.0.0",
                HostPort: "10030"
            }
        ]);
    });
});
