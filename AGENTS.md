<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# ALWAYS VERIFY BEFORE COMMITTING

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] `npm run build` has run and `./dist/` is up to date

# ALWAYS VERIFY AFTER PUSHING

- [ ] `./scripts/npx-test.sh` do not produce failures
- [ ] `./scripts/npm-install-test.sh` do not produce failures
