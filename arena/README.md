# Team Pack — Arena Agent Usage

Arena Agent Mode has **no skills runtime** (no auto-invoke, no `/command` wiring) — so this folder is used as **workspace playbooks** the agent reads on request. Copy `skills/` and `agents/` into your Arena workspace (`/home/user/`), then invoke by name.

## Setup

```bash
# from this folder, in an Arena workspace:
cp -r skills agents /home/user/
```

Or run the one-command setup from the pack root:

```bash
./install.sh arena
```

## How to invoke

| You say | Agent does |
|---|---|
| `Use the <skill> skill to …` | Reads `skills/<skill>/SKILL.md` and follows its workflow |
| `Act as the <agent> agent` | Adopts `agents/<agent>.md` persona and rules |
| `Route this: …` | Reads `skills/team-skills/SKILL.md` router, picks one skill |
| `Run /pm:prd for …` | Executes the named workflow from the agent/skill text |

## Examples

- "Use the data-science skill to explain why bookings dipped last week."
- "Act as the Legal Compliance agent and review this consent copy: …"
- "Route this: support keeps seeing join failures on low-end Android."
- "Run /ops:close with these numbers: …"

## Tips

- **Start of a work session**: name the skill + paste the relevant context — Arena agents don't preload skills into context.
- **Cross-domain work**: say "hand off per the skill's escalation matrix" and the agent will switch playbooks explicitly.
- **`scripts/`-style automation**: there is no scripts convention here — just ask the agent to run shell commands directly; it has full bash access.
- **Multi-model**: Arena routes across models, so keep instructions explicit — what's obvious to one model may not trigger another. Naming the skill file path helps.
