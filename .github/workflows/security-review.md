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
if: github.ref == 'refs/heads/main'
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
mcp-servers:
  linear-write:
    url: "https://mcp.linear.app/mcp"
    headers:
      Authorization: "Bearer ${{ secrets.LINEAR_API_KEY }}"
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
  group: security-review-${{ inputs.revision }}-${{ inputs.scope }}
  job-discriminator: ${{ inputs.revision }}-${{ inputs.scope }}
safe-outputs:
  report-failure-as-issue: false
jobs:
  safe_outputs:
    permissions:
      contents: read
      issues: none
  conclusion:
    permissions:
      contents: read
      issues: none
---

Review revision `${{ inputs.revision }}` and scope `${{ inputs.scope }}`. After the review, autonomously create the complete Linear project and one issue per confirmed finding, subject to the agent's duplicate and initiative rules.

- Do not wait for conversational approval. This manually dispatched workflow is authorized to write the review's Linear project and issues.
- Never create or update GitHub issues, pull requests, commits, branches, or files.
- Return the project link and every issue link only after the corresponding Linear calls succeed. Report failed or skipped writes explicitly.