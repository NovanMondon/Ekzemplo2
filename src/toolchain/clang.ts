import { runCommand } from "./runCommand.js";

export const compileLlvmIrWithClang = async (llPath: string, binPath: string): Promise<void> => {
	await runCommand("clang", [llPath, "-fuse-ld=lld", "-o", binPath]);
};
