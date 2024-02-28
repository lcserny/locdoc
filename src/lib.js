import * as util from "util";
import * as cp from "child_process";

const exec = util.promisify(cp.exec);

export async function myFunc(manifest) {
    try {
        const {stdout, stderr} = await exec(`ls ${manifest}`);
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
    } catch (err) {
        console.log(`err: ${err}`);
    }

    return "hello";
}
