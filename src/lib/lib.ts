import fs from "node:fs/promises";
import util from "node:util";
import child_process from "node:child_process";
import winston, {transports} from "winston";
import type {Ora} from "ora";
import type {OptionValues} from "commander";

const { combine, timestamp, prettyPrint, printf, errors } = winston.format;

export const exec = util.promisify(child_process.exec);

export function getRandomNumberAsString(min: number, max: number) {
    return Math.floor(Math.random() * (max - min) + min).toString();
}

class SpinnerConsoleTransport extends transports.Console {

    private spinner?: Ora;

    constructor(spinner?: Ora) {
        super();
        this.spinner = spinner;
    }

    log(info: unknown, next: () => void) {
        const spinning = this.spinner?.isSpinning;
        if (spinning) {
            this.spinner?.stop();
        }
        super.log?.(info, next);
        if (spinning) {
            this.spinner?.start();
        }
    }
}

export function splitAtFirst(text: string, separator: string): [string, string] {
    const index = text.indexOf(separator);
    if (index === -1) {
        // Separator not found, return the original string as the first part
        return [text, ""];
    } else {
        const part1 = text.substring(0, index); // Or text.slice(0, index)
        const part2 = text.substring(index + separator.length); // Or text.slice(index + separator.length)
        return [part1, part2];
    }
}

export function createLogger(args: OptionValues, spinner?: Ora) {
    return winston.createLogger({
        level: "info",
        format: combine(errors({stack: true}), timestamp(), args.json
            ? prettyPrint()
            : printf(({timestamp, level, message, stack}) => {
                const text = `${timestamp} ${level.toUpperCase()} ${message}`;
                return stack ? text + '\n' + stack : text;
            })),
        transports: [new SpinnerConsoleTransport(spinner)]
    });
}

export async function symlinkExists(symlinkPath: string) {
    try {
        await fs.lstat(symlinkPath);
        return true;
    } catch (e) {
        return false;
    }
}
