const {ManifestParser} = require("../src/manifest");
const {logger, createTmpFile, cleanupTmp} = require("../src/test-util");

describe("manifestParser", () => {
    afterEach(() => cleanupTmp());

    const parser = new ManifestParser(logger, "someName");

    test("using minimal yaml, parse should give back correct manifest", async () => {
        const minimalContainerManifest = `
artifact:
    repo: "someGitRepo"
config:
    repo: "anotherGitRepo"
    destinationPath: "somePath"
`.trim();

        const f = await createTmpFile(minimalContainerManifest);

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

        const f = await createTmpFile(minimalNodeCliManifest);

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