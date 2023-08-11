import { config as dotenv } from 'dotenv';

dotenv();

const optionKeys = <const>[
  'GITHUB_TOKEN',
  'GITHUB_REPO_NAME',
  'GITHUB_REPO_OWENER',
  'GITHUB_PROJECT_NUMBER',

  'TRELLO_TOKEN',
  'TRELLO_KEY',
  'TRELLO_BOARD_ID',
];

export type Options = Record<(typeof optionKeys)[number], string>;

export const options = optionKeys.reduce((ac, key) => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured.`);
  return { ...ac, [key]: value };
}, {} as Options);
