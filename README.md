# Description
LocDoc is an utility app designed to provide an easy way to create and use a local Docker deployment pipeline for an application.

# Install
1. `npm install`
2. `npm test`
3. `npm link`

# Prerequisites
This tool will use your local installations of the following:
- git
- bash
- docker
- node
- maven
- gradle
- cargo

# Usage
`locdoc -m pathToManifestFile`

Example manifest file for a local profile: e.g. `commander-local.yml`  
```
name: "commander application"
artifact:
    repo: "git@github.com/lcserny/commander.git"
    tag: "2.1.0"
    dockerFile: "Dockerfile"
    buildCmd: "mvn clean build"
config:
    repo: "git@github.com/lcserny/commander-config.git"
    tag: "1.0.5_local"
    destinationPath: "src/main/resources"
image:
    name: "vm-commander"
    version: "1.0"
deploy:
    type: container
    name: app-name
    network: "vm-network"
    runFlags: "--restart unless-stopped -p 8090:8090 -v /mnt/d:/data"
```

Notes:
- the artifact repo should have a Dockerfile for the application somewhere
- the destinationPath of the config is relative to the artifact repo root, that is where the config repo will be cloned
- on the deploy section, if a network is specified, it will be created (if not existing) and added to the container run flags