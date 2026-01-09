import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import tmp from "tmp-promise";
import {SystemDBasicDeployer, type SystemDBasicManifest, SystemDDeployer, type SystemDManifest} from "../src/lib/systemd";
import {createFakeGit, logger} from "../src/lib/test-util";

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
            fs.writeFileSync(path.join(d.path, "app.js"), "data here", "utf8");

            expect(fs.existsSync(manifest.deploy.path)).toBeFalsy();
            await deployer.copyArtifact(d.path);
            expect(fs.existsSync(manifest.deploy.path)).toBeTruthy();

            expect(fs.existsSync(path.join(d.path, serviceName))).toBeFalsy();
            await deployer.createSystemDFile(d.path, serviceName, d.path);
            expect(fs.existsSync(path.join(d.path, serviceName))).toBeTruthy();
            const serviceFileContents = fs.readFileSync(path.join(d.path, serviceName), "utf8");
            expect(serviceFileContents.includes(manifest.deploy.name)).toBeTruthy();
            expect(serviceFileContents.includes(manifest.deploy.cmdPrefix)).toBeTruthy();
            expect(serviceFileContents.includes(manifest.deploy.preRunFlags)).toBeTruthy();
            expect(serviceFileContents.includes(manifest.deploy.postRunFlags)).toBeTruthy();
        }, {unsafeCleanup: true});
    });
});

describe("systemD-basic deployer", () => {
    test("deployer deploys correctly", async () => {
        await tmp.withDir(async (d) => {
            const manifest = {
                deploy: {
                    type: "systemd-basic",
                    name: "myService",
                    path: path.join(d.path, "outPath", "app.js"),
                }
            };
            fs.mkdirSync(path.dirname(manifest.deploy.path), { recursive: true });

            const deployer = new SystemDBasicDeployer(d.path, manifest as SystemDBasicManifest, logger, createFakeGit());

            const serviceName = `${manifest.deploy.name}.service`;
            fs.writeFileSync(path.join(manifest.deploy.path), "data here", "utf8");

            expect(fs.existsSync(path.join(d.path, serviceName))).toBeFalsy();
            await deployer.createSystemDFile(d.path, serviceName);
            expect(fs.existsSync(path.join(d.path, serviceName))).toBeTruthy();

            const serviceFileContents = fs.readFileSync(path.join(d.path, serviceName), "utf8");
            expect(serviceFileContents.includes(manifest.deploy.name)).toBeTruthy();
        }, {unsafeCleanup: true});
    });
});