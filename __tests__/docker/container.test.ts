import {ContainerOptionsParser} from "../../src/docker/container";
import tmp from "tmp-promise";
import fs from "node:fs/promises";

describe("container parser", () => {
    test("can parse --env-file", async () => {
        await tmp.withFile(async (f) => {
            await fs.writeFile(f.path, "FOO=bar\nBAZ=qux");

            const parser = new ContainerOptionsParser();
            const options = parser.parseRunOptions("contName", "imgName", `--env-file=${f.path}`);

            expect(options.Env).toEqual(["FOO=bar", "BAZ=qux"]);
        }, {postfix: ".tmp"});
    });

    test("can parse --memory", () => {
        const parser = new ContainerOptionsParser();

        let options = parser.parseRunOptions("contName", "imgName", `--memory=512m`);
        expect(options.HostConfig?.Memory).toEqual(512 * 1024 * 1024);

        options = parser.parseRunOptions("contName", "imgName", `--memory=5g`);
        expect(options.HostConfig?.Memory).toEqual(5 * 1024 * 1024 * 1024);
    });

    test("can parse --restart", () => {
        const parser = new ContainerOptionsParser();

        let options = parser.parseRunOptions("contName", "imgName", `--restart=always`);
        expect(options.HostConfig?.RestartPolicy?.Name).toEqual("always");

        options = parser.parseRunOptions("contName", "imgName", `--restart="always"`);
        expect(options.HostConfig?.RestartPolicy?.Name).toEqual("always");
    });

    test("can parse --add-host", () => {
        const parser = new ContainerOptionsParser();

        let options = parser.parseRunOptions("contName", "imgName", `--add-host=leo:somewhere`);
        expect(options.HostConfig?.ExtraHosts?.length).toEqual(1);
        expect(options.HostConfig?.ExtraHosts[0]).toEqual("leo:somewhere");

        options = parser.parseRunOptions("contName", "imgName", `--add-host="leo:somewhere"`);
        expect(options.HostConfig?.ExtraHosts?.length).toEqual(1);
        expect(options.HostConfig?.ExtraHosts[0]).toEqual("leo:somewhere");
    });

    test("can parse --volume", () => {
        const parser = new ContainerOptionsParser();

        let options = parser.parseRunOptions("contName", "imgName", `--volume=/host/path:/container/path`);
        expect(options.HostConfig?.Binds?.length).toEqual(1);
        expect(options.HostConfig?.Binds?.[0]).toEqual("/host/path:/container/path");

        options = parser.parseRunOptions("contName", "imgName", `--volume="/host/path:/container/path"`);
        expect(options.HostConfig?.Binds?.length).toEqual(1);
        expect(options.HostConfig?.Binds?.[0]).toEqual("/host/path:/container/path");
    });

    test("can parse --publish", () => {
        const parser = new ContainerOptionsParser();

        const options = parser.parseRunOptions("contName", "imgName", `--publish=10030:80`);
        expect(options.ExposedPorts?.["80/tcp"]).toEqual({});
        expect(options.HostConfig?.PortBindings?.["80/tcp"]).toEqual([
            {
                HostIp: "0.0.0.0",
                HostPort: "10030"
            }
        ]);
    });
});
