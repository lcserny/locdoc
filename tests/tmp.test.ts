import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import tmp from "tmp-promise";
import {createFiles} from "../src/lib/test-util";

describe("tmp util tests", () => {
    test("creating tmp dir without any files", async () => {
        await tmp.withDir(async (dir) => {
            expect(fs.existsSync(dir.path)).toBeTruthy();
        });
    });

    test("creating tmp dir with files", async () => {
        const filesMap: Map<string, string> = new Map();
        filesMap.set("f1.json", `["hello"]`);
        filesMap.set("f2.yml", `some: test`);

        await tmp.withDir(async (dir) => {
            createFiles(dir.path, filesMap);
            expect(fs.existsSync(dir.path)).toBeTruthy();

            const f1 = path.join(dir.path, "f1.json");
            expect(fs.existsSync(f1)).toBeTruthy();
            expect(fs.readFileSync(f1, "utf8")).toBe(`["hello"]`);

            const f2 = path.join(dir.path, "f2.yml");
            expect(fs.existsSync(f2)).toBeTruthy();
            expect(fs.readFileSync(f2, "utf8")).toBe(`some: test`);
        }, {unsafeCleanup: true});
    });
});
