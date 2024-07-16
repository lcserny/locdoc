const {logger, createFakeGit} = require("../src/test-util");
const tmp = require("tmp-promise");
const path = require("node:path");
const fs = require("node:fs/promises");
const {SystemDDeployer} = require("../src/systemd");
const fse = require("fs-extra");

describe("systemD deployer", () => {
    test("deployer deploys correctly", async () => {
        await tmp.withDir(async (d) => {
            const manifest = {
                deploy: {
                    type: "systemd",
                    name: "myService",
                    cmdPrefix: "prefix",
                    path: path.join(d.path, "outPath"),
                    preRunFlags: "-Dmy.flag=hi",
                    postRunFlags: "-Dmy.other.flag=hello"
                },
                artifact: {
                    repo: "systemdGitRepo",
                    buildCmd: "build!",
                    buildExecutable: "app.js"
                },
                config: {
                    repo: "configSystemdGitRepo",
                    destinationPath: "aPath"
                }
            };

            const deployer = new SystemDDeployer(d.path, manifest, logger, createFakeGit());

            const serviceName = `${manifest.deploy.name}.service`;
            await fs.writeFile(path.join(d.path, "app.js"), "data here", "utf8");

            expect(fse.pathExistsSync(manifest.deploy.path)).toBeFalsy();
            await deployer.copyArtifact(d.path);
            expect(fse.pathExistsSync(manifest.deploy.path)).toBeTruthy();

            expect(fse.pathExistsSync(path.join(d.path, serviceName))).toBeFalsy();
            await deployer.createSystemDFile(d.path, serviceName);
            expect(fse.pathExistsSync(path.join(d.path, serviceName))).toBeTruthy();
            const serviceFileContents = await fs.readFile(path.join(d.path, serviceName), "utf8");
            expect(serviceFileContents.includes(manifest.deploy.name)).toBeTruthy();
            expect(serviceFileContents.includes(manifest.deploy.cmdPrefix)).toBeTruthy();
            expect(serviceFileContents.includes(manifest.deploy.preRunFlags)).toBeTruthy();
            expect(serviceFileContents.includes(manifest.deploy.postRunFlags)).toBeTruthy();
        }, {unsafeCleanup: true});
    });
});