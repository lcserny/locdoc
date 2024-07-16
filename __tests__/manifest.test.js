const {ManifestParser} = require("../src/manifest");
const {logger} = require("../src/test-util");
const tmp = require("tmp-promise");
const fs = require("node:fs/promises");

describe("manifestParser", () => {
    const parser = new ManifestParser(logger, "someName");

    test("using minimal yaml, parse should give back correct manifest", async () => {
        const minimalContainerManifest = `
artifact:
    repo: "someGitRepo"
config:
    repo: "anotherGitRepo"
    destinationPath: "somePath"
`.trim();

        await tmp.withFile(async (f) => {
            await fs.writeFile(f.path, minimalContainerManifest);
            const manifest = await parser.parse(f.path);

            expect(manifest.artifact.repo).toBe("someGitRepo");
            expect(manifest.artifact.tag).toBe("master");
            expect(manifest.artifact.dockerFile).toBe("Dockerfile");
            expect(manifest.artifact.buildCmd).toBeNull();
            expect(manifest.config.repo).toBe("anotherGitRepo");
            expect(manifest.config.tag).toBe("master");
            expect(manifest.config.destinationPath).toBe("somePath");
            expect(manifest.image.name).toBe("someName-image");
            expect(manifest.image.version).toBe("1.0");
            expect(manifest.deploy.type).toBe("container");
            expect(manifest.deploy.name).toBe("someName");
        });
    });

    test("using minimal node-cli yaml, parse should give back correct manifest", async () => {
        const minimalNodeCliManifest = `
deploy:
    type: nodejs-cli
    binOut: outPath
    bins: 
        one: "one.js"
        two: "src/two.js"
artifact:
    repo: "cliGitRepo"
config:
    repo: "configCliGitRepo"
    destinationPath: "aPath"
`.trim();

        await tmp.withFile(async (f) => {
            await fs.writeFile(f.path, minimalNodeCliManifest);
            const manifest = await parser.parse(f.path);

            expect(manifest.artifact.repo).toBe("cliGitRepo");
            expect(manifest.artifact.tag).toBe("master");
            expect(manifest.artifact.buildCmd).toBe("npm install");
            expect(manifest.config.repo).toBe("configCliGitRepo");
            expect(manifest.config.tag).toBe("master");
            expect(manifest.config.destinationPath).toBe("aPath");
            expect(manifest.deploy.type).toBe("nodejs-cli");
            expect(manifest.deploy.binOut).toBe("outPath");
            expect(manifest.deploy.name).toBe("someName");
            expect(manifest.deploy.bins.one).toBe("one.js");
            expect(manifest.deploy.bins.two).toBe("src/two.js");
        });
    });

    test("using minimal systemd yaml, parse should give back correct manifest", async () => {
        const minimalSystemDManifest = `
deploy:
    type: systemd
    cmdPrefix: "prefix"
    path: "outPath"
    preRunFlags: "-Dmy.flag=hi"
    postRunFlags: "-Dmy.other.flag=hello"
artifact:
    repo: "systemdGitRepo"
    buildCmd: "build!"
    buildExecutable: "out/app.js"
config:
    repo: "configSystemdGitRepo"
    destinationPath: "aPath"
`.trim();

        await tmp.withFile(async (f) => {
            await fs.writeFile(f.path, minimalSystemDManifest);
            const manifest = await parser.parse(f.path);

            expect(manifest.artifact.repo).toBe("systemdGitRepo");
            expect(manifest.artifact.tag).toBe("master");
            expect(manifest.artifact.buildCmd).toBe("build!");
            expect(manifest.artifact.buildExecutable).toBe("out/app.js");
            expect(manifest.config.repo).toBe("configSystemdGitRepo");
            expect(manifest.config.tag).toBe("master");
            expect(manifest.config.destinationPath).toBe("aPath");
            expect(manifest.deploy.type).toBe("systemd");
            expect(manifest.deploy.cmdPrefix).toBe("prefix");
            expect(manifest.deploy.name).toBe("someName");
            expect(manifest.deploy.path).toBe("outPath");
            expect(manifest.deploy.preRunFlags).toBe("-Dmy.flag=hi");
            expect(manifest.deploy.postRunFlags).toBe("-Dmy.other.flag=hello");
        });
    });
});