export type EmitContext = {
	sourceFilename: string;
};

export type FunctionEmitContext = EmitContext & {
	nextTemp: () => string;
};
