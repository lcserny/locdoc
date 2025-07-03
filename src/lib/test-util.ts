import winston from "winston";
import fs from "node:fs/promises";
import tmp from "tmp-promise";
import path from "node:path";
import {Git} from "../api/vcs";
import {ContainerWrapper, DockerWrapper} from "../api/container";

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

export function createFakeGit(): Git {
    return { clone: jest.fn().mockImplementation(() => { }) };
}

export function createFakeDocker(): DockerWrapper {
    return {
        cleanup: jest.fn().mockImplementation(() => { }),

        buildImage: jest.fn().mockImplementation(() => { }),

        createContainer: jest.fn().mockImplementation(() => { }),
        getContainer: jest.fn().mockImplementation(() => { }),

        createNetwork: jest.fn().mockImplementation(() => { }),
        networkExists: jest.fn().mockImplementation(() => { }),
    };
}

export function createFakeContainer(): ContainerWrapper {
    return {
        start: jest.fn().mockImplementation(() => { }),
        stop: jest.fn().mockImplementation(() => { }),
        remove: jest.fn().mockImplementation(() => { }),

        getStatus: jest.fn().mockImplementation(() => { })
    };
}
