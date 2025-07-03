export class BaseManifest {
    protected name: string;

    constructor(randomName: string) {
        this.name = randomName
    }

    validate() {
        throw new Error("not implemented");
    }
}