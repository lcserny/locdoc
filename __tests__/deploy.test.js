const {DeployRetriever} = require("../src/deploy");
const {logger, createFakeGit} = require("../src/test-util");
const {CONTAINER, ContainerDeployer} = require("../src/container");
const {NodeJSCliDeployer, NODEJS_CLI} = require("../src/nodejs-cli");
const {BaseDeployer} = require("../src/lib");
const path = require("node:path");
const fse = require("fs-extra");
const tmp = require("tmp-promise");
const {SYSTEMD, SystemDDeployer} = require("../src/systemd");

describe("deployRetriever", () => {
    test("retriever produces container deployer", async () => {
        const retriever = new DeployRetriever(CONTAINER, "", null, logger);
        const deployer = retriever.getDeployer();

        expect(deployer instanceof ContainerDeployer).toBeTruthy();
    });

    test("retriever produces nodejs-cli deployer", async () => {
        const retriever = new DeployRetriever(NODEJS_CLI, "", null, logger);
        const deployer = retriever.getDeployer();

        expect(deployer instanceof NodeJSCliDeployer).toBeTruthy();
    });

    test("retriever produces systemd deployer", async () => {
        const retriever = new DeployRetriever(SYSTEMD, "", null, logger);
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
            const deployer = new BaseDeployer(logger, d.path, manifest, git);

            const artifactRepoDir = await deployer.cloneArtifactRepo();

            const ardRegex = new RegExp(String.raw`^${d.path}.*${manifest.deploy.name}`, "g");
            expect(git.clone).toHaveBeenCalledTimes(1);
            expect(git.clone).toHaveBeenCalledWith(manifest.artifact.repo, expect.stringMatching(ardRegex), {'--branch': manifest.artifact.tag});
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
                    destinationPath: "my/path"
                }
            };

            const git = createFakeGit();
            const deployer = new BaseDeployer(logger, d.path, manifest, git);
            const artifactRepoDir = path.join(d.path, manifest.deploy.name);

            const configRepoDir = await deployer.cloneConfigRepo(artifactRepoDir);

            const cfgRegex = new RegExp(String.raw`^${artifactRepoDir}.*${manifest.config.destinationPath}`, "g");
            expect(git.clone).toHaveBeenCalledTimes(1);
            expect(git.clone).toHaveBeenCalledWith(manifest.config.repo, expect.any(String), {'--branch': manifest.config.tag});
            expect(configRepoDir).toMatch(cfgRegex);
        }, {unsafeCleanup: true});
    });

    test("base deployer can execute build cmd", async () => {
        await tmp.withDir(async (d) => {
            const artifactRepoDir = d.path;
            const cmdPath = "touchedTestFiled";
            const manifest = { artifact: { buildCmd: `touch ${cmdPath}` } };
            const deployer = new BaseDeployer(logger, d.path, manifest, {});

            await deployer.executeBuildCommand(artifactRepoDir);

            expect(await fse.pathExists(path.join(artifactRepoDir, cmdPath))).toBeTruthy();
        }, {unsafeCleanup: true});
    });
});