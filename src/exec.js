import childProcess from 'child_process';

export async function runCmd(cmd) {
    const child = childProcess.spawn("bash", ["-c", cmd]);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    let out = [];
    for await (const data of child.stdout) {
        out.push(data);
    }

    let error = "";
    for await (const data of child.stderr) {
        error += data;
    }

    const exitCode = await new Promise((resolve, reject) => {
        child.on("close", resolve);
    });

    if (exitCode) {
        throw new Error(`(${exitCode}) ${error}`);
    }

    return out;
}