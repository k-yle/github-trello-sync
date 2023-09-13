# GitHub ↔️ Trello Sync

A simple NodeJS tool to sync a GitHub Project Board with Trello. All changes must be made in the GitHub board. These changes are automatically mirrored to the Trello board.

The following information can be synced:

- Issue Number
- Issue Title
- Issue Description
- Assignees
- Labels
- Milestone
- Linked PRs
- GitHub Project metadata (such as Priority / start date)
- GitHub Tasklists ↔️ Trello Checklists

## Usage

- Download NodeJS v18 or newer
- Rename [`.env.example`](./.env.example) to `.env`, and populate the file with real values
- Run `npm start` every few hours.
