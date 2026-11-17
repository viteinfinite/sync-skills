import chalk from 'chalk';
function formatVerboseEvent(event) {
    const parts = [
        `phase=${event.phase}`,
        `action=${event.action}`
    ];
    if (event.reason)
        parts.push(`reason=${event.reason}`);
    if (event.skill)
        parts.push(`skill=${event.skill}`);
    if (event.platform)
        parts.push(`platform=${event.platform}`);
    if (event.path)
        parts.push(`path=${event.path}`);
    if (event.fromPath)
        parts.push(`from=${event.fromPath}`);
    if (event.toPath)
        parts.push(`to=${event.toPath}`);
    if (event.result)
        parts.push(`result=${event.result}`);
    return `[verbose] ${parts.join(' ')}`;
}
export class VerboseLogger {
    enabled;
    operations = [];
    constructor(enabled) {
        this.enabled = enabled;
    }
    decision(event) {
        if (!this.enabled)
            return;
        console.log(chalk.gray(formatVerboseEvent(event)));
    }
    skillOperation(event) {
        this.operations.push({
            action: event.action,
            reason: event.reason,
            skill: event.skill,
            platform: event.platform,
            path: event.path,
            fromPath: event.fromPath,
            toPath: event.toPath
        });
        this.decision({
            phase: event.phase,
            action: event.action,
            reason: event.reason,
            skill: event.skill,
            platform: event.platform,
            path: event.path,
            fromPath: event.fromPath,
            toPath: event.toPath,
            result: event.result ?? 'ok'
        });
    }
    printSummary() {
        if (!this.enabled)
            return;
        const skillOps = this.operations.filter(op => op.path || op.toPath || op.fromPath);
        if (skillOps.length === 0) {
            console.log(chalk.gray('[verbose-summary] skill-operations=0'));
            return;
        }
        const counts = new Map();
        for (const op of skillOps) {
            const key = `${op.action}:${op.reason}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        }
        console.log(chalk.cyanBright('[verbose-summary] SKILL.md operations'));
        for (const [key, value] of counts.entries()) {
            console.log(chalk.gray(`[verbose-summary] ${key} count=${value}`));
        }
        for (const op of skillOps) {
            const location = op.path
                ? `path=${op.path}`
                : `from=${op.fromPath ?? '-'} to=${op.toPath ?? '-'}`;
            console.log(chalk.gray(`[verbose-summary] ${op.action} reason=${op.reason} ${location}`));
        }
    }
}
//# sourceMappingURL=logger.js.map