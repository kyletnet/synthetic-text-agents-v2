export declare function generateJSON<T = unknown>(args: {
    system?: string;
    prompt: string;
    schemaHint?: string;
    runId?: string;
}): Promise<{
    text: string;
    json?: T | undefined;
    usedDryRun: boolean;
}>;
//# sourceMappingURL=llmAdapter.d.ts.map