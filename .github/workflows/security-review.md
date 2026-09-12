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
    - api.linear.app
tools:
  bash: false
  edit: false
  cli-proxy: false
  github:
    toolsets: [repos]
    mode: remote
max-turns: 40
concurrency:
  group: security-review-${{ github.workflow }}
  job-discriminator: ${{ github.run_id }}
safe-outputs:
  report-failure-as-issue: false
  jobs:
    linear-write:
      description: Create the single Linear security project and its finding issues from structured review findings.
      runs-on: ubuntu-latest
      permissions:
        contents: read
      env:
        LINEAR_API_KEY: "${{ secrets.LINEAR_API_KEY }}"
        LINEAR_TEAM_ID: "${{ vars.LINEAR_TEAM_ID }}"
        LINEAR_INITIATIVE_ID: "${{ vars.LINEAR_INITIATIVE_ID }}"
        GITHUB_WORKFLOW_SCOPE: "${{ inputs.scope }}"
      inputs:
        findings:
          description: JSON array of confirmed findings. The writer supplies project and issue metadata.
          required: true
          type: string
      steps:
        - name: Create Linear project and issues
          run: |
            node <<'NODE'
            const fs = require('fs');
            const output = JSON.parse(fs.readFileSync(process.env.GH_AW_AGENT_OUTPUT, 'utf8'));
            const items = output.items.filter((item) => item.type === 'linear_write');
            if (items.length !== 1) throw new Error('Expected exactly one linear_write handoff');
            const findings = JSON.parse(items[0].findings);
            if (!Array.isArray(findings) || findings.length === 0) throw new Error('Expected a non-empty findings array');
            const required = ['severity', 'title', 'evidence', 'impact', 'remediation', 'proof'];
            for (const finding of findings) {
              if (!finding || required.some((field) => typeof finding[field] !== 'string' || !finding[field].trim())) throw new Error('Malformed finding payload');
            }
            if (!process.env.LINEAR_API_KEY || !process.env.LINEAR_TEAM_ID || !process.env.LINEAR_INITIATIVE_ID) throw new Error('Linear configuration is incomplete');
            const scope = (process.env.GITHUB_WORKFLOW_SCOPE || '').trim().toLowerCase().replace(/\s+/g, ' ');
            const key = `security-review|adamhinckley/dc-inventory|${process.env.GITHUB_SHA}|${scope}`;
            async function gql(query, variables = {}) {
              const response = await fetch('https://api.linear.app/graphql', { method: 'POST', headers: { Authorization: process.env.LINEAR_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
              const body = await response.json();
              if (!response.ok || body.errors) throw new Error(JSON.stringify(body.errors || body));
              return body.data;
            }
            const existing = await gql('query($term:String!){ projects(filter:{search:{containsIgnoreCase:$term}}){nodes{id,description,url}} }', { term: key });
            let project = existing.projects.nodes.find((candidate) => candidate.description?.includes(key));
            if (!project) {
              const created = await gql('mutation($input:ProjectCreateInput!){ projectCreate(input:$input){success project{id,description,url}} }', { input: { name: `Security review - ${scope} - ${new Date().toISOString().slice(0,10)}`, description: `Security review key: ${key}\n\nAutonomous defensive review.`, teamIds: [process.env.LINEAR_TEAM_ID] } });
              if (!created.projectCreate.success) throw new Error('Linear project creation failed');
              project = created.projectCreate.project;
              await gql('mutation($id:ID!,$input:ProjectUpdateInput!){ projectUpdate(id:$id,input:$input){success} }', { id: project.id, input: { initiativeIds: [process.env.LINEAR_INITIATIVE_ID] } });
            }
            const issues = await gql('query($project:ID!){ project(id:$project){issues{nodes{title,description}}} }', { project: project.id });
            for (const finding of findings) {
              const title = `[${finding.severity}] ${finding.title}`;
              if (issues.project.issues.nodes.some((issue) => issue.title === title && issue.description?.includes(key))) continue;
              const description = `Review key: ${key}\n\nEvidence:\n${finding.evidence}\n\nImpact:\n${finding.impact}\n\nRecommended remediation:\n${finding.remediation}\n\nProof:\n${finding.proof}`;
              await gql('mutation($input:IssueCreateInput!){ issueCreate(input:$input){success} }', { input: { teamId: process.env.LINEAR_TEAM_ID, projectId: project.id, title, description } });
            }
            console.log(`Linear project created or reused for ${key}`);
            NODE
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

Review the immutable commit checked out by this main-branch workflow and scope `${{ inputs.scope }}`. After the review, autonomously hand confirmed findings to the trusted `linear-write` safe output, which creates the complete Linear project and one issue per finding.

- Do not wait for conversational approval. This manually dispatched workflow is authorized to write the review's Linear project and issues.
- The reviewer has no Linear credential or write-capable external tool. Call `linear-write` once with only the JSON findings array after the review. The safe job owns all Linear reads and writes.
- Never create or update GitHub issues, pull requests, commits, branches, or files.
- Return the project link and every issue link only after the corresponding Linear calls succeed. Report failed or skipped writes explicitly.