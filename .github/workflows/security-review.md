---
name: DC Inventory security review
description: Run the defensive DC Inventory security review and optionally create the approved Linear batch.
intent: Find evidenced security defects and turn an explicitly approved review into one Linear project with one issue per finding.
on:
  workflow_dispatch:
    inputs:
      mode:
        description: "review drafts findings; create is Adam's explicit approval to write the exact proposed Linear batch"
        required: true
        type: choice
        options:
          - review
          - create
      scope:
        description: "Optional review scope, such as auth boundaries or all checks"
        required: false
        type: string
        default: all checks
      revision:
        description: "Optional branch, tag, or commit to review"
        required: false
        type: string
        default: main
permissions:
  contents: read
  copilot-requests: write
engine:
  id: copilot
  model: gpt-5.6-sol
imports:
  - .github/agents/dc-inventory-security.agent.md
network:
  allowed:
    - defaults
    - mcp.linear.app
tools:
  github:
    toolsets: [repos]
    mode: remote
  linear:
    token: "${{ secrets.LINEAR_API_KEY }}"
    allowed:
      - list_projects
      - get_project
      - create_project
      - list_issues
      - get_issue
      - create_issue
      - update_issue
max-turns: 40
concurrency:
  group: security-review-${{ github.run_id }}
  job-discriminator: ${{ github.run_id }}
---

Review revision `${{ inputs.revision }}` and scope `${{ inputs.scope }}`.

The dispatch mode is `${{ inputs.mode }}`.

- In `review` mode, perform the complete review, report findings and recommended remediations, and draft the one-project Linear batch. Do not call any Linear write tool.
- In `create` mode, perform the review again on the requested revision and create Linear work only for the findings confirmed in this run. Adam's selection of `create` is the explicit approval for this run. Create exactly one project and one issue per confirmed finding, subject to the agent's duplicate and initiative rules.
- Never create or update GitHub issues, pull requests, commits, branches, or files.
- Return the project link and every issue link only after the corresponding Linear calls succeed. Report failed or skipped writes explicitly.