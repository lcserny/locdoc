import type {SimpleGit} from "simple-git";
import simpleGit from "simple-git";
import type {Git} from "../git";

export class DefaultGit implements Git {

    private git: SimpleGit = simpleGit();

    async clone(repo: string, path: string, branch?: string) {
        const options = branch ? {"--branch": branch} : undefined;
        await this.git.clone(repo, path, options);
    }
}