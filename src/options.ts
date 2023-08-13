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

  'USERNAME_MAP',
];
const optional = new Set<(typeof optionKeys)[number]>([
  // subset of `optionKeys` which are optional
  'USERNAME_MAP',
]);

export type Options = Record<(typeof optionKeys)[number], string>;

export const options = optionKeys.reduce((ac, key) => {
  let value = process.env[key];
  if (!value) {
    if (optional.has(key)) {
      value = '';
    } else {
      throw new Error(`${key} is not configured.`);
    }
  }
  return { ...ac, [key]: value };
}, {} as Options);
