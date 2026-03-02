export const escapeLlvmIdentifier = (name: string): string => {
	// LLVM identifiers can be either: @name or @"name with spaces"
	// We keep it simple and quote if it contains characters outside [A-Za-z0-9_.$].
	return /^[A-Za-z0-9_.$]+$/.test(name) ? name : `"${escapeLlvmString(name)}"`;
};

export const escapeLlvmString = (value: string): string => {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
};
