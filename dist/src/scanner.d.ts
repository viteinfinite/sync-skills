interface WalkDirResult {
    agent: string;
    skillName: string;
    path: string;
    relativePath: string;
}
interface ScanResult {
    claude: WalkDirResult[];
    codex: WalkDirResult[];
    common: WalkDirResult[];
}
export declare function scanSkills(baseDir?: string): Promise<ScanResult>;
export {};
//# sourceMappingURL=scanner.d.ts.map