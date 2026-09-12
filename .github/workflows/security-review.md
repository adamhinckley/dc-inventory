---
name: DC Inventory security review
description: Run the defensive DC Inventory security review and create the complete Linear hardening project.
intent: Find evidenced security defects and turn each review into one Linear project with one issue per finding.
on:
  workflow_dispatch:
    inputs:
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

Review revision `${{ inputs.revision }}` and scope `${{ inputs.scope }}`. After the review, autonomously create the complete Linear project and one issue per confirmed finding, subject to the agent's duplicate and initiative rules.

- Do not wait for conversational approval. This manually dispatched workflow is authorized to write the review's Linear project and issues.
- Never create or update GitHub issues, pull requests, commits, branches, or files.
- Return the project link and every issue link only after the corresponding Linear calls succeed. Report failed or skipped writes explicitly.