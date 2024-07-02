const winston = require("winston");
const fs = require("node:fs/promises");
const tmp = require("tmp-promise");
const path = require("node:path");
const { combine, timestamp, prettyPrint, errors } = winston.format;

tmp.setGracefulCleanup();

const cleanups = [];

const logger = winston.createLogger({
    format: combine(errors({stack: true}), timestamp(), prettyPrint()),
    transports: [new winston.transports.Console()]
});

async function createTmpFile(contents) {
    const f = await tmp.file();
    await fs.writeFile(f.path, contents);
    cleanups.push(f.cleanup);
    return f;
}

async function createTmpDir(filesMap) {
    filesMap = filesMap || new Map();
    const d = await tmp.dir({unsafeCleanup: true});
    for (let [fileName, contents] of filesMap) {
        const fullPath = path.join(d.path, fileName);
        await fs.writeFile(fullPath, contents);
    }
    cleanups.push(d.cleanup);
    return d;
}

function cleanupTmp() {
    cleanups.forEach((c) => c());
}

module.exports = {
    logger,
    createTmpFile,
    createTmpDir,
    cleanupTmp
};
