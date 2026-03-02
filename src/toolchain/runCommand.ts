import { spawn } from "node:child_process";

export const runCommand = async (command: string, args: string[]): Promise<void> => {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, { stdio: "inherit" });
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve();
			reject(new Error(`${command} exited with code ${code ?? "null"}`));
		});
	});
};
