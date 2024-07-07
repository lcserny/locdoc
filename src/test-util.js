const winston = require("winston");
const fs = require("node:fs/promises");
const tmp = require("tmp-promise");
const path = require("node:path");
const { combine, timestamp, prettyPrint, errors } = winston.format;

tmp.setGracefulCleanup();

const logger = winston.createLogger({
    format: combine(errors({stack: true}), timestamp(), prettyPrint()),
    transports: [new winston.transports.Console()]
});

async function createFiles(dir, filesMap) {
    filesMap = filesMap || new Map();
    for (let [fileName, contents] of filesMap) {
        const fullPath = path.join(dir, fileName);
        await fs.writeFile(fullPath, contents);
    }
}

function createFakeGit() {
    return { clone: jest.fn().mockImplementation(() => { }) };
}

function createFakeDocker() {
    return { command: jest.fn().mockImplementation(() => { }) };
}

module.exports = {
    logger,
    createFakeGit,
    createFakeDocker,
    createFiles
};