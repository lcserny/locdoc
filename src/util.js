export function getRandomNumberAsString(min, max) {
    return Math.floor(Math.random() * (max - min) + min).toString();
}
