"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const path = require("node:path");
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
let client;
const activate = async (context) => {
    const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));
    const serverOptions = {
        run: { module: serverModule, transport: node_1.TransportKind.ipc },
        debug: { module: serverModule, transport: node_1.TransportKind.ipc },
    };
    const clientOptions = {
        documentSelector: [{ scheme: "file", language: "ekzemplo2" }],
        synchronize: {
            fileEvents: vscode_1.workspace.createFileSystemWatcher("**/*.ekz2"),
        },
    };
    client = new node_1.LanguageClient("ekzemplo2LanguageServer", "Ekzemplo2 Language Server", serverOptions, clientOptions);
    context.subscriptions.push(client);
    await client.start();
};
exports.activate = activate;
const deactivate = async () => {
    if (!client) {
        return;
    }
    await client.stop();
    client = undefined;
};
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map