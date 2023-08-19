import type { GitHub } from '../api/GitHub';

export const getTitlePrefix = (ghIssueNumber: number) => `#${ghIssueNumber}:`;

export const createTrelloTitle = (ghIssue: GitHub.Issue) =>
  `${getTitlePrefix(ghIssue.number)} ${ghIssue.title}`;

const ghUserToMarkdown = (ghUser: GitHub.User) =>
  `[${ghUser.name || ghUser.login}](${ghUser.html_url})`;

const ghMilestoneToMarkdown = (ghMilestone: GitHub.Milestone) =>
  `[${ghMilestone.title}](${ghMilestone.resourcePath})`;

export const createTrelloDescription = (
  ghIssue: GitHub.Issue,
  attributes: GitHub.ProjectAttributes,
) =>
  [
    `## [View Original on GitHub](${ghIssue.html_url})`,
    `**Created by:** ${ghUserToMarkdown(ghIssue.user!)}`,
    `**Assigned to:** ${
      ghIssue.assignees?.map(ghUserToMarkdown).join(' and ') || 'no one'
    }`,
    `**Associated PR:** None`, // TODO:
    `**Milestone:** ${
      attributes.Milestone
        ? ghMilestoneToMarkdown(attributes.Milestone!)
        : 'none'
    }`,
    ...Object.entries(attributes).flatMap(([key, value]) => {
      if (typeof value === 'object' || key === 'Title' || key === 'Status') {
        return [];
      }

      return [`**${key}:** \`${value}\``];
    }),
    '',
    '---',
    '',
    ghIssue.body || '',
  ].join('\n');
