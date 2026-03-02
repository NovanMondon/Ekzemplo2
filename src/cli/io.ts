import { readFile } from "node:fs/promises";

export const readAllStdin = async (): Promise<string> => {
	if (process.stdin.isTTY) {
		return "";
	}

	return await new Promise<string>((resolve, reject) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => resolve(data));
		process.stdin.on("error", reject);
	});
};

export const readSourceText = async (filePath?: string): Promise<string> => {
	return filePath ? await readFile(filePath, "utf8") : await readAllStdin();
};
