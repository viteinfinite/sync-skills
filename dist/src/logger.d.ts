type VerboseOperation = {
    action: 'create' | 'rewrite' | 'copy' | 'delete';
    reason: string;
    skill?: string;
    platform?: string;
    path?: string;
    fromPath?: string;
    toPath?: string;
};
type VerboseEvent = {
    phase: string;
    action: string;
    reason?: string;
    skill?: string;
    platform?: string;
    path?: string;
    fromPath?: string;
    toPath?: string;
    result?: string;
};
export declare class VerboseLogger {
    private readonly enabled;
    private readonly operations;
    constructor(enabled: boolean);
    decision(event: VerboseEvent): void;
    skillOperation(event: VerboseOperation & {
        phase: string;
        result?: string;
    }): void;
    printSummary(): void;
}
export {};
//# sourceMappingURL=logger.d.ts.map