---
allowed-tools: Bash, Read, TodoWrite, Grep, Glob
description: Answer questions about teamwork domain without coding
argument-hint: [question]
---

# teamwork Expert - Question Mode

Answer the user's question by analyzing teamwork implementation and patterns in this codebase. This prompt provides information without making code changes.

## Variables

USER_QUESTION: $1
EXPERTISE_PATH: .claude/commands/experts/teamwork/expertise.yaml

## Instructions

- IMPORTANT: This is a question-answering task only - DO NOT write, edit, or create any files
- Focus on teamwork-related functionality
- If the question requires code changes, explain what would need to be done conceptually without implementing
- With your expert knowledge, validate the information from `EXPERTISE_PATH` against the codebase before answering

## Workflow

- Read the `EXPERTISE_PATH` file to understand teamwork architecture and patterns
- Review, validate, and confirm information from `EXPERTISE_PATH` against the codebase
- Respond based on the `Report` section below

## Report

- Direct answer to the `USER_QUESTION`
- Supporting evidence from `EXPERTISE_PATH` and the codebase
- References to the exact files and lines of code that support the answer
- High-mid level conceptual explanations
- Include diagrams where appropriate to streamline communication
