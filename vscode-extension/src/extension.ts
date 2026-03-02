import * as path from "node:path";

import { ExtensionContext, workspace } from "vscode";
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

export const activate = async (context: ExtensionContext): Promise<void> => {
	const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));

	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc },
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: "file", language: "ekzemplo2" }],
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher("**/*.ekz2"),
		},
	};

	client = new LanguageClient(
		"ekzemplo2LanguageServer",
		"Ekzemplo2 Language Server",
		serverOptions,
		clientOptions,
	);

	context.subscriptions.push(client);
	await client.start();
};

export const deactivate = async (): Promise<void> => {
	if (!client) {
		return;
	}
	await client.stop();
	client = undefined;
};
