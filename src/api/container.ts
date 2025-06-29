export interface ContainerWrapper {
    start(): Promise<void>;
    stop(): Promise<void>;
    remove(): Promise<void>;

    getStatus(): Promise<string>;
}

export interface DockerWrapper {
    cleanup(): Promise<void>;

    // eslint-disable-next-line no-unused-vars
    createContainer(dockerContainer: string, dockerImage: string, convertedCmd: string): Promise<ContainerWrapper>
    // eslint-disable-next-line no-unused-vars
    getContainer(filterName: string): Promise<ContainerWrapper | undefined>

    // eslint-disable-next-line no-unused-vars
    networkExists(filterName: string): Promise<boolean>
    // eslint-disable-next-line no-unused-vars
    createNetwork(networkName: string): Promise<void>;

    // eslint-disable-next-line no-unused-vars
    buildImage(imageName: string, src: string[], context: string): Promise<void>;
}