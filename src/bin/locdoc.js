#!/usr/bin/env node

import * as argparse from "argparse";
import * as fs from "fs/promises";
import * as lib from "../lib.js";

const parser = new argparse.ArgumentParser({
    description: "Local Docker Deployer"
});
parser.add_argument("-m", "--manifest", { required: true, help: "path to deployment manifest file" });
const args = parser.parse_args();

const contents = await fs.readFile("/home/leonardo/projects/locdoc/package.json");
console.log(`${contents}`);
console.log(await lib.myFunc(args.manifest));
