const {cleanupTmp, createTmpDir} = require("../src/test-util");
const fs = require("node:fs/promises");
const path = require("node:path");

async function pathExists(p) {
    try {
        await fs.access(p);
        return true;
    } catch (e) {
        return false;
    }
}

describe("tmp util tests", () => {
    afterEach(() => cleanupTmp());

    test("creating tmp dir without any files", async () => {
        const dir = await createTmpDir();
        expect(pathExists(dir.path)).toBeTruthy();
    });

    test("creating tmp dir with files", async () => {
        const filesMap = new Map();
        filesMap.set("f1.json", `["hello"]`);
        filesMap.set("f2.yml", `some: test`);

        const dir = await createTmpDir(filesMap);
        expect(pathExists(dir.path)).toBeTruthy();

        const f1 = path.join(dir.path, "f1.json");
        expect(pathExists(f1)).toBeTruthy();
        expect(await fs.readFile(f1, "utf8")).toBe(`["hello"]`);

        const f2 = path.join(dir.path, "f2.yml");
        expect(pathExists(f2)).toBeTruthy();
        expect(await fs.readFile(f2, "utf8")).toBe(`some: test`);
    });
});