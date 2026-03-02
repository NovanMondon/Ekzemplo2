import { execa } from "execa";

export type RunCommandOptions = {
	timeoutMs?: number;
};

export const runCommand = async (
	command: string,
	args: string[],
	options: RunCommandOptions = {},
): Promise<void> => {
	try {
		const subprocess = execa(command, args, {
			all: true,
			reject: true,
			timeout: options.timeoutMs,
		});
		subprocess.all?.pipe(process.stdout);
		await subprocess;
	} catch (error) {
		const maybeExecaError = error as {
			stderr?: string;
			stdout?: string;
			shortMessage?: string;
		};
		const detail =
			maybeExecaError.stderr?.trim() ||
			maybeExecaError.stdout?.trim() ||
			maybeExecaError.shortMessage;
		if (detail) {
			throw new Error(`${command} failed: ${detail}`, { cause: error });
		}
		if (error instanceof Error) {
			throw new Error(`${command} failed: ${error.message}`, { cause: error });
		}
		throw new Error(`${command} failed`, { cause: error });
	}
};
