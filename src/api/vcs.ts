export interface Git {
    // eslint-disable-next-line no-unused-vars
    clone(repo: string, path: string, branch?: string): Promise<void>;
}