import { mock } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import tmp from "tmp-promise";
import winston from "winston";
import type {ContainerWrapper, DockerWrapper} from "../api/container";
import type {Git} from "../api/vcs";

const { combine, timestamp, prettyPrint, errors } = winston.format;

tmp.setGracefulCleanup();

export const logger = winston.createLogger({
    format: combine(errors({stack: true}), timestamp(), prettyPrint()),
    transports: [new winston.transports.Console()],
    level: "none"
});

export function createFiles(dir: string, filesMap: Map<string, string>) {
    filesMap = filesMap || new Map();
    for (const [fileName, contents] of filesMap) {
        const fullPath = path.join(dir, fileName);
        fs.writeFileSync(fullPath, contents);
    }
}

export function createFakeGit(): Git {
    return { clone: mock(async () => {}) };
}

export function createFakeDocker(): DockerWrapper {
    return {
        cleanup: mock(async () => { }),
        buildImage: mock(async () => { }),
        createContainer: mock(async () => {
            return {} as ContainerWrapper;
        } ),
        getContainer: mock(async () => { return undefined }),
        createNetwork: mock(async () => { }),
        networkExists: mock(async () => { return false }),
    };
}

export function createFakeContainer(): ContainerWrapper {
    return {
        start: mock(async () => { }),
        stop: mock(async () => { }),
        remove: mock(async () => { }),
        getStatus: mock(async () => { return "up" })
    };
}
