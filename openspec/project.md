# Project Context

## Purpose
sync-skills is a CLI tool that centralizes and synchronizes AI assistant skills across multiple platforms. By maintaining a single source of truth for your skills, it ensures consistency and reduces duplication of effort when managing AI capabilities.

## Tech Stack
- TypeScript
- npm-based CLI

## Project Conventions

### Testing Strategy
- Unit Tests: Focus on individual functions and modules to ensure they work as expected in isolation.
- Integration Tests: Validate the interaction between different modules and the overall functionality of the sync-skills tool. Run these via the command: `npm test:integration`
- Test Directory: Run integration tests in a dedicated subdirectory (e.g., `./test-dir`) to avoid conflicts with other files and ensure a clean testing environment.
- Run all tests using the command: `npm test:all`

## Domain Context
Read the [Agent Skills Specification](docs/skills-specifications.md) for detailed information on skills.