import {createFakeGit, logger} from "../src/test-util";
import {NodeJSCliDeployer} from "../src/nodejs-cli";
import path from "node:path";
import fse from "fs-extra";
import fs from "node:fs/promises";
import tmp from "tmp-promise";
import type {Manifest} from "../src/lib";

describe("nodejs-cli deployer", () => {
    test("deployer deploys correctly", async () => {
        await tmp.withDir(async (d) => {
            const binOut = path.join(d.path, "bin");
            await fs.mkdir(binOut, {recursive: true});

            const bins: unknown = { firstCmd: "one.js", secondCmd: "two.js", };
            const manifest = {
                deploy: {
                    binOut: binOut,
                    bins: bins
                }
            };
            const baseName = "myRepo";
            const artifactRepoDir = path.join(d.path, baseName)
            await fs.mkdir(artifactRepoDir, {recursive: true});

            const deployer = new NodeJSCliDeployer(d.path, manifest as Manifest, logger, createFakeGit());

            expect(await fse.pathExists(artifactRepoDir)).toBeTruthy();
            const newArtifactPath = await deployer.moveCli(artifactRepoDir);
            expect(await fse.pathExists(artifactRepoDir)).toBeFalsy();
            expect(await fse.pathExists(newArtifactPath)).toBeTruthy();

            await fs.writeFile(path.join(newArtifactPath, "one.js"), "");
            await fs.writeFile(path.join(newArtifactPath, "two.js"), "");

            const firstCmdPath = path.join(binOut, "firstCmd");
            const secondCmdPath = path.join(binOut, "secondCmd");

            expect(await fse.pathExists(firstCmdPath)).toBeFalsy()
            expect(await fse.pathExists(secondCmdPath)).toBeFalsy();

            await deployer.createSymlink(newArtifactPath);

            expect(await fse.pathExists(firstCmdPath)).toBeTruthy();
            expect(await fse.pathExists(secondCmdPath)).toBeTruthy();
            const firstCmdStat = await fs.lstat(firstCmdPath);
            expect(String(firstCmdStat.mode)).toMatch(/41471|41398/);
            const secondCmdStat = await fs.lstat(secondCmdPath);
            expect(String(secondCmdStat.mode)).toMatch(/41471|41398/);

            await fs.rm(firstCmdPath);
            await fs.rm(secondCmdPath);

            await fs.symlink(path.join(newArtifactPath, "one.js_wrong"), firstCmdPath, "junction");
            await fs.symlink(path.join(newArtifactPath, "two.js_wrong"), secondCmdPath, "junction");

            await deployer.createSymlink(newArtifactPath);

            expect(await fse.pathExists(firstCmdPath)).toBeTruthy();
            expect(await fse.pathExists(secondCmdPath)).toBeTruthy();
        }, {unsafeCleanup: true});
    });
});