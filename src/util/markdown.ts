import type { GitHub } from '../api/GitHub';
import { options } from '../options';

const pipe =
  <T>(...functions: ((x: T) => T)[]) =>
  (x0: T) =>
    functions.reduce((x, f) => f(x), x0);

export const getTitlePrefix = (ghIssueNumber: number) => `#${ghIssueNumber}:`;

export const createTrelloTitle = (ghIssue: GitHub.Issue) =>
  `${getTitlePrefix(ghIssue.number)} ${ghIssue.title}`;

const ghUserToMarkdown = (ghUser: GitHub.User) =>
  `[${ghUser.name || ghUser.login}](${ghUser.html_url})`;

const ghMilestoneToMarkdown = (ghMilestone: GitHub.Milestone) =>
  `[${ghMilestone.title}](https://github.com${ghMilestone.resourcePath})`;

const ghLinkedPRToMarkdown = (ghLinkedPr: GitHub.LinkedPRs) =>
  `[#${ghLinkedPr.nodes[0].number}](${ghLinkedPr.nodes[0].permalink})`;

/** trello doesn't support github-flavoured markdown, so replace label URLs with label names */
const decodeLabelSyntax = (text: string) =>
  text.replaceAll(
    new RegExp(
      `https://github\\.com/${options.GITHUB_REPO_OWENER}/${options.GITHUB_REPO_NAME}/labels/([A-Za-z0-9_%-]+)`,
      'g',
    ),
    (_, encodedLabelName) => `\`${decodeURIComponent(encodedLabelName)}\``,
  );

export const extractChecklistItemsFromMarkdown = (markdown: string) =>
  [...markdown.matchAll(/ *- *\[( |x)] (.+)(\r|\n)/g)].map(
    ([, checkboxValue, label]) => ({
      completed: checkboxValue === 'x',
      label: label.trim(),
    }),
  );

/**
 * removes all the text that was extracted by
 * {@link extractChecklistItemsFromMarkdown}.
 */
export const removeChecklistsFromMarkdown = (markdown: string) =>
  markdown.replaceAll(
    /( *- *\[( |x)] (.+)\n)+/gm,
    '- _✨ checklist moved to the "Checklist" section below_\n',
  );

/** also add trailing new line to the end of the file */
const stripCRLF = (markdown: string) => `${markdown.replaceAll('\r', '')}\n`;

export const cleanGitHubMarkdown = pipe(
  stripCRLF,
  removeChecklistsFromMarkdown,
  decodeLabelSyntax,
);

export const createTrelloDescription = (
  ghIssue: GitHub.Issue,
  attributes: GitHub.ProjectAttributes,
) =>
  [
    `## [View Original on GitHub](${ghIssue.html_url})`,
    `**Created by:** ${ghUserToMarkdown(ghIssue.user!)}`,
    `**Assigned to:** ${
      ghIssue.assignees?.map(ghUserToMarkdown).join(' and ') || 'None'
    }`,
    `**Associated PR:** ${
      attributes['Linked pull requests']
        ? ghLinkedPRToMarkdown(attributes['Linked pull requests']!)
        : 'None'
    }`,
    `**Milestone:** ${
      attributes.Milestone
        ? ghMilestoneToMarkdown(attributes.Milestone!)
        : 'None'
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
    cleanGitHubMarkdown(ghIssue.body || ''),
  ].join('\n');
