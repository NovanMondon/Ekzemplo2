"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeWithCompiler = void 0;
const node_child_process_1 = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const node_1 = require("vscode-languageserver/node");
const COMPILER_DIAG_REGEX = /^(.*?):(\d+):(\d+):\s*(syntax|type|semantic) error:\s*(.*)$/;
const workspaceRoot = () => {
    // NOTE: at runtime __dirname points to `vscode-extension/dist`, not `src`.
    // We need the repo root that contains the main package.json with `scripts.exec`.
    let dir = path.resolve(__dirname);
    for (let i = 0; i < 15; i += 1) {
        const packageJsonPath = path.join(dir, "package.json");
        if (fs.existsSync(packageJsonPath)) {
            try {
                const raw = fs.readFileSync(packageJsonPath, "utf8");
                const pkg = JSON.parse(raw);
                if (pkg.scripts && typeof pkg.scripts.exec === "string") {
                    return dir;
                }
            }
            catch {
                // ignore and keep walking up
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    // Fallback: in this repo layout `dist -> vscode-extension -> <repoRoot>`.
    return path.resolve(__dirname, "../..");
};
const analyzeWithCompiler = (sourceText) => {
    // `npm run` prints its own header lines to stdout, which would break JSON parsing.
    // Use `--silent` so stdout contains only the compiler output.
    const run = (0, node_child_process_1.spawnSync)("npm", ["run", "--silent", "exec", "--", "--dump-ast"], {
        cwd: workspaceRoot(),
        input: sourceText,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
    });
    if (run.error) {
        return {
            diagnostics: [
                {
                    severity: node_1.DiagnosticSeverity.Error,
                    range: node_1.Range.create(0, 0, 0, 1),
                    message: run.error.message,
                    source: "ekzemplo2-ls",
                },
            ],
        };
    }
    if (run.status === 0) {
        try {
            return {
                ast: JSON.parse(run.stdout),
                diagnostics: [],
            };
        }
        catch {
            return {
                diagnostics: [
                    {
                        severity: node_1.DiagnosticSeverity.Error,
                        range: node_1.Range.create(0, 0, 0, 1),
                        message: "compiler returned invalid AST JSON",
                        source: "ekzemplo2-ls",
                    },
                ],
            };
        }
    }
    const stderr = run.stderr ?? "";
    const line = stderr
        .split(/\r?\n/u)
        .map((part) => part.trim())
        .find((part) => COMPILER_DIAG_REGEX.test(part));
    if (line) {
        const matched = line.match(COMPILER_DIAG_REGEX);
        if (matched) {
            const diagLine = Number(matched[2] ?? "1");
            const diagColumn = Number(matched[3] ?? "0");
            const message = matched[5] ?? "compile error";
            return {
                diagnostics: [
                    {
                        severity: node_1.DiagnosticSeverity.Error,
                        range: node_1.Range.create(Math.max(0, diagLine - 1), Math.max(0, diagColumn), Math.max(0, diagLine - 1), Math.max(0, diagColumn + 1)),
                        message,
                        source: "ekzemplo2-ls",
                    },
                ],
            };
        }
    }
    return {
        diagnostics: [
            {
                severity: node_1.DiagnosticSeverity.Error,
                range: node_1.Range.create(0, 0, 0, 1),
                message: stderr.trim() || "failed to run compiler analysis",
                source: "ekzemplo2-ls",
            },
        ],
    };
};
exports.analyzeWithCompiler = analyzeWithCompiler;
//# sourceMappingURL=compilerBridge.js.map