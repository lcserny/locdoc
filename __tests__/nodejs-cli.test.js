const {logger, createFakeGit} = require("../src/test-util");
const {NodeJSCliDeployer} = require("../src/nodejs-cli");
const path = require("node:path");
const fse = require("fs-extra");
const fs = require("node:fs/promises");
const tmp = require("tmp-promise");

describe("nodejs-cli deployer", () => {
    test("deployer deploys correctly", async () => {
        await tmp.withDir(async (d) => {
            const binOut = path.join(d.path, "bin");
            await fs.mkdir(binOut, {recursive: true});

            const manifest = {
                deploy: {
                    binOut: binOut,
                    bins: {
                        firstCmd: "one.js",
                        secondCmd: "two.js",
                    }
                }
            };
            const baseName = "myRepo";
            const artifactRepoDir = path.join(d.path, baseName)
            await fs.mkdir(artifactRepoDir, {recursive: true});

            const deployer = new NodeJSCliDeployer(d.path, manifest, logger, createFakeGit());

            expect(await fse.pathExists(artifactRepoDir)).toBeTruthy();
            const newArtifactPath = await deployer.moveCli(artifactRepoDir);
            expect(await fse.pathExists(artifactRepoDir)).toBeFalsy();
            expect(await fse.pathExists(newArtifactPath)).toBeTruthy();

            await fs.writeFile(path.join(newArtifactPath, "one.js"), "");
            await fs.writeFile(path.join(newArtifactPath, "two.js"), "");

            expect(await fse.pathExists(path.join(binOut, "firstCmd"))).toBeFalsy()
            expect(await fse.pathExists(path.join(binOut, "secondCmd"))).toBeFalsy();

            await deployer.createSymlink(newArtifactPath);

            expect(await fse.pathExists(path.join(binOut, "firstCmd"))).toBeTruthy();
            expect(await fse.pathExists(path.join(binOut, "secondCmd"))).toBeTruthy();

            await fs.rm(path.join(binOut, "firstCmd"));
            await fs.rm(path.join(binOut, "secondCmd"));

            await fs.symlink(path.join(newArtifactPath, "one.js_wrong"), path.join(binOut, "firstCmd"));
            await fs.symlink(path.join(newArtifactPath, "two.js_wrong"), path.join(binOut, "secondCmd"));

            await deployer.createSymlink(newArtifactPath);

            expect(await fse.pathExists(path.join(binOut, "firstCmd"))).toBeTruthy();
            expect(await fse.pathExists(path.join(binOut, "secondCmd"))).toBeTruthy();
        }, {unsafeCleanup: true});
    });
});