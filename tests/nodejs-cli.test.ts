import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import tmp from "tmp-promise";
import {NodeJSCliDeployer, type NodeJSCliManifest} from "../src/lib/nodejs-cli";
import {createFakeGit, logger} from "../src/lib/test-util";

describe("nodejs-cli deployer", () => {
    test("deployer deploys correctly", async () => {
        await tmp.withDir(async (d) => {
            const binOut = path.join(d.path, "bin");
            fs.mkdirSync(binOut, {recursive: true});

            const bins: unknown = { firstCmd: "one.js", secondCmd: "two.js", };
            const manifest = {
                deploy: {
                    binOut: binOut,
                    bins: bins
                }
            };
            const baseName = "myRepo";
            const artifactRepoDir = path.join(d.path, baseName)
            fs.mkdirSync(artifactRepoDir, {recursive: true});

            const deployer = new NodeJSCliDeployer(d.path, manifest as NodeJSCliManifest, logger, createFakeGit());

            expect(fs.existsSync(artifactRepoDir)).toBeTruthy();
            const newArtifactPath = await deployer.moveCli(artifactRepoDir);
            expect(fs.existsSync(artifactRepoDir)).toBeFalsy();
            expect(fs.existsSync(newArtifactPath)).toBeTruthy();

            fs.writeFileSync(path.join(newArtifactPath, "one.js"), "");
            fs.writeFileSync(path.join(newArtifactPath, "two.js"), "");

            const firstCmdPath = path.join(binOut, "firstCmd");
            const secondCmdPath = path.join(binOut, "secondCmd");

            expect(fs.existsSync(firstCmdPath)).toBeFalsy()
            expect(fs.existsSync(secondCmdPath)).toBeFalsy();

            await deployer.createSymlink(newArtifactPath);

            expect(fs.existsSync(firstCmdPath)).toBeTruthy();
            expect(fs.existsSync(secondCmdPath)).toBeTruthy();
            const firstCmdStat = fs.lstatSync(firstCmdPath);
            expect(String(firstCmdStat.mode)).toMatch(/41471|41398/);
            const secondCmdStat = fs.lstatSync(secondCmdPath);
            expect(String(secondCmdStat.mode)).toMatch(/41471|41398/);

            fs.rmSync(firstCmdPath);
            fs.rmSync(secondCmdPath);

            fs.symlinkSync(path.join(newArtifactPath, "one.js_wrong"), firstCmdPath, "junction");
            fs.symlinkSync(path.join(newArtifactPath, "two.js_wrong"), secondCmdPath, "junction");

            await deployer.createSymlink(newArtifactPath);

            expect(fs.existsSync(firstCmdPath)).toBeTruthy();
            expect(fs.existsSync(secondCmdPath)).toBeTruthy();
        }, {unsafeCleanup: true});
    });
});