import fs from "node:fs/promises";
import path from "node:path";
import fse from "fs-extra";
import {createFiles} from "../src/test-util";
import tmp from "tmp-promise";

describe("tmp util tests", () => {
    test("creating tmp dir without any files", async () => {
        await tmp.withDir(async (dir) => {
            expect(await fse.pathExists(dir.path)).toBeTruthy();
        });
    });

    test("creating tmp dir with files", async () => {
        const filesMap: Map<string, string> = new Map();
        filesMap.set("f1.json", `["hello"]`);
        filesMap.set("f2.yml", `some: test`);

        await tmp.withDir(async (dir) => {
            await createFiles(dir.path, filesMap);
            expect(await fse.pathExists(dir.path)).toBeTruthy();

            const f1 = path.join(dir.path, "f1.json");
            expect(await fse.pathExists(f1)).toBeTruthy();
            expect(await fs.readFile(f1, "utf8")).toBe(`["hello"]`);

            const f2 = path.join(dir.path, "f2.yml");
            expect(await fse.pathExists(f2)).toBeTruthy();
            expect(await fs.readFile(f2, "utf8")).toBe(`some: test`);
        }, {unsafeCleanup: true});
    });
});
