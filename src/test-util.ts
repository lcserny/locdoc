import winston from "winston";
import fs from "node:fs/promises";
import tmp from "tmp-promise";
import path from "node:path";

const { combine, timestamp, prettyPrint, errors } = winston.format;

tmp.setGracefulCleanup();

export const logger = winston.createLogger({
    format: combine(errors({stack: true}), timestamp(), prettyPrint()),
    transports: [new winston.transports.Console()],
    level: "none"
});

export async function createFiles(dir: string, filesMap: Map<string, string>) {
    filesMap = filesMap || new Map();
    for (const [fileName, contents] of filesMap) {
        const fullPath = path.join(dir, fileName);
        await fs.writeFile(fullPath, contents);
    }
}

export function createFakeGit() {
    return { clone: jest.fn().mockImplementation(() => { }) };
}

export function createFakeDocker() {
    return { command: jest.fn().mockImplementation(() => { }) };
}
