import {createFakeGit, logger} from "../src/lib/test-util";
import tmp from "tmp-promise";
import path from "node:path";
import fs from "node:fs/promises";
import {SystemDDeployer, SystemDManifest} from "../src/lib/systemd";
import fse from "fs-extra";

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

            const deployer = new SystemDDeployer(d.path, manifest as SystemDManifest, logger, createFakeGit());

            const serviceName = `${manifest.deploy.name}.service`;
            await fs.writeFile(path.join(d.path, "app.js"), "data here", "utf8");

            expect(fse.pathExistsSync(manifest.deploy.path)).toBeFalsy();
            await deployer.copyArtifact(d.path);
            expect(fse.pathExistsSync(manifest.deploy.path)).toBeTruthy();

            expect(fse.pathExistsSync(path.join(d.path, serviceName))).toBeFalsy();
            await deployer.createSystemDFile(d.path, serviceName, d.path);
            expect(fse.pathExistsSync(path.join(d.path, serviceName))).toBeTruthy();
            const serviceFileContents = await fs.readFile(path.join(d.path, serviceName), "utf8");
            expect(serviceFileContents.includes(manifest.deploy.name)).toBeTruthy();
            expect(serviceFileContents.includes(manifest.deploy.cmdPrefix)).toBeTruthy();
            expect(serviceFileContents.includes(manifest.deploy.preRunFlags)).toBeTruthy();
            expect(serviceFileContents.includes(manifest.deploy.postRunFlags)).toBeTruthy();
        }, {unsafeCleanup: true});
    });
});