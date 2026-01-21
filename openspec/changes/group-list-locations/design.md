# Design: Grouping Skill Locations

## Data Structures

The current `listSkills` implementation uses a flat array of skill occurrences:
```typescript
allSkills: Array<{
  name: string;
  description: string;
  site: string;
  fileCount: number;
}>
```

This will be changed to a Map or a grouped structure:
```typescript
groupedSkills: Map<string, {
  name: string;
  description: string;
  sites: string[];
}>
```

## Logic Updates

1. **Aggregation**: As skills are processed, they will be added to the `groupedSkills` map indexed by their `skillName`.
2. **Description Selection**: 
   - Favor the description from the `common` site if available.
   - Otherwise, use the first description found.
3. **Site Sorting**:
   - Within the brackets, `common` should always come first if present, followed by other platforms alphabetically.

## Output Format
Example:
`before-pushing           [common, claude, codex] - Use when about to push commits to remote repository`
