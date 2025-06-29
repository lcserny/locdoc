import simpleGit, {SimpleGit} from "simple-git";
import {Git} from "../../api/vcs";

export class DefaultGit implements Git {
    private git: SimpleGit = simpleGit();

    async clone(repo: string, path: string, branch?: string) {
        const options = branch ? {"--branch": branch} : undefined;
        await this.git.clone(repo, path, options);
    }
}