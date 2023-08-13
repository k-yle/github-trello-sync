import type { GitHub } from '../api/GitHub';
import type { Trello } from '../api/Trello';
import { options } from '../options';

const trelloUserMap = new URLSearchParams(
  options.USERNAME_MAP.replaceAll(/, */g, '&'),
);

export const findTrelloUser = (
  trelloUsers: Trello.Member[],
  ghUser: GitHub.User,
): string => {
  // first, see if the user has configured an override
  const overrideTrelloUserName = trelloUserMap.get(ghUser.login);
  const overrideTrelloUser = trelloUsers.find(
    (trelloUser) => trelloUser.username === overrideTrelloUserName,
  );

  if (overrideTrelloUser) return overrideTrelloUser.id;

  // if no override specified, try to match by username
  const matchedTrelloUser = trelloUsers.find(
    (trelloUser) =>
      trelloUser.username === ghUser.login ||
      trelloUser.fullName === ghUser.name,
  );
  if (matchedTrelloUser) return matchedTrelloUser.id;

  // no match found, so crash.
  throw new Error(
    `Unclear what GH user “${ghUser.login}”’s username is on Trello. Add them to the USERNAME_MAP env variable`,
  );
};
