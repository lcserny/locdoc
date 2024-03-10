import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import * as os from "os";
import { generate } from "random-words";

export async function createWorkDir() {
    const prefixes = generate({ exactly: 1 });
    return fs.mkdtemp(path.join(os.tmpdir(), prefixes[0]));
}

export async function removeWorkDir(workDir) {
    fs.rm(workDir, { recursive: true, force: true });
}

export function checkDockerfileExists(rootDir, dockerFilePath) {
    const fullPath = path.join(rootDir, dockerFilePath);
    if (!fsSync.existsSync(fullPath)) {
        throw new Error(`Dockerfile not found in pathh ${fullPath}`);
    }
}
