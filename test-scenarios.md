Test Scenario 1
  1. I have skills inside .claude/skills/my-skill
  2. I don't still have a .codex folder
  3. The script should ask me if I want .codex/skills to be created
  4. If I say yes, it should create .codex/skills and reference the common skills

Test Scenario 2
  1. I have skills inside .claude/skills/my-skill
  2. I already have a .codex folder
  3. The script should not ask me anything and just create .codex/skills and reference the common skills

Test Scenario 3
  1. I don't have any skills inside .claude/skills
  2. I don't have a .codex folder
  3. The script should not create anything and just exit

Test Scenario 4
  1. I have skills inside .codex/skills/my-skill
  2. I don't still have a .claude folder
  3. The script should ask me if I want .claude/skills to be created
  4. If I say no, it should not create anything and just exit

Test Scenario 5
  1. I have skills inside .codex/skills/my-skill
  2. I already have a .claude folder
  3. The script should not ask me anything and just create .claude/skills and reference the common skills

The implementation should be modular, so that we can easily add support for more assistants in the future. The code files namings should reflect that.
