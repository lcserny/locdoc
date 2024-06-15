function getRandomNumberAsString(min, max) {
    return Math.floor(Math.random() * (max - min) + min).toString();
}

class BaseManifest {
    constructor(randomName) {
        this.name = randomName
    }

    validate() {
        throw new Error("not implemented");
    }
}

module.exports = {
    getRandomNumberAsString,
    BaseManifest
}