import { DockerHandler } from "./docker.js";

export function retrieveDeployHandler(logger, manifest, artifactRepoDir) {
    switch (manifest.deploy.type) {
        case "container":
            return new DockerHandler(logger, manifest, artifactRepoDir);
        default:
            throw new Error(`Deploy type not recognized '${manifest.deploy.type}'`);
    }
}