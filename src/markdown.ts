import type { GitHub } from './api/GitHub';

export const getTitlePrefix = (ghIssueNumber: number) => `#${ghIssueNumber}:`;

export const createTrelloTitle = (ghIssue: GitHub.Issue) =>
  `${getTitlePrefix(ghIssue.number)} ${ghIssue.title}`;

export const createTrelloDescription = (ghIssue: GitHub.Issue) =>
  [
    `Created by: ${ghIssue.user!.name || ghIssue.user!.login}`,
    `Assigned to: ${
      ghIssue.assignees?.map((a) => a.name || a.login).join(' and ') || 'no one'
    }`,
    '',
    '',
    ghIssue.body || '',
  ].join('\n');
