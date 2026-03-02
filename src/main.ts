import { runCli } from "./cli/runCli.js";

export const main = async (): Promise<void> => {
	await runCli(process.argv.slice(2));
};
