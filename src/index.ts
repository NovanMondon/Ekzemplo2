import { main } from "./main.js";
import {
	formatCompileDiagnostic,
	isCompileDiagnosticError,
} from "./diagnostics/compileDiagnostic.js";

try {
	await main();
} catch (e) {
	if (isCompileDiagnosticError(e)) {
		console.error(formatCompileDiagnostic(e));
		process.exitCode = 1;
	} else {
		const message = e instanceof Error ? e.message || e.toString() : String(e);
		console.error(`parse: failed\n${message}`);
		process.exitCode = 1;
	}
}
