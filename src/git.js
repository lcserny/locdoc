import { simpleGit } from "simple-git";
import * as path from "path";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import { generate } from "random-words";
import * as fsExtra from "fs-extra";

export class GitHandler {
    constructor(logger) {
        this.logger = logger;
    }

    async cloneArtifact(manifest, workDir) {
        this.logger.info(`Cloning artifact '${manifest.artifact.repo}'`);

        const repoDir = path.join(workDir, manifest.image.name);
        return this.clone(manifest.artifact.repo, manifest.artifact.tag, repoDir);
    }

    async cloneConfig(manifest, workDir, artifactRepoDir) {
        this.logger.info(`Cloning config '${manifest.config.repo}'`);
        
        const tmpDir = path.join(workDir, generate({exactly: 1})[0]);
        await this.clone(manifest.config.repo, manifest.config.tag, tmpDir);
        const repoDir = path.join(artifactRepoDir, manifest.config.destinationPath);
        await fsExtra.move(tmpDir, repoDir, {overwrite: true});
        return repoDir;
    }

    async clone(repo, tag, repoDir) {
        if (!fsSync.existsSync(repoDir)) {
            await fs.mkdir(repoDir);
        }

        const git = simpleGit(repoDir);
        await git.clone(repo, repoDir);

        if (tag != null) {
            git.checkout(tag);
        }

        return repoDir;
    }
}
