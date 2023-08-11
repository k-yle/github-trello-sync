import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { GitHub, getGitHubProjects } from './api/GitHub';
import { Trello } from './api/Trello';
import {
  createTrelloDescription,
  createTrelloTitle,
  getTitlePrefix,
} from './markdown';
import { options } from './options';

const github = new GitHub({ auth: options.GITHUB_TOKEN });
const trello = new Trello(options.TRELLO_KEY, options.TRELLO_TOKEN);

async function main() {
  //
  // 0. Fetch data
  //
  console.log('Fetching GH Issues…');
  const { data: ghIssues } = await github.rest.issues.listForRepo({
    owner: options.GITHUB_REPO_OWENER,
    repo: options.GITHUB_REPO_NAME,
  });
  console.log('Fetching GH Project…');
  const ghProjects = await getGitHubProjects(github);

  console.log('Fetching Trello Board…');
  const trelloBoard = await trello.getBoard(options.TRELLO_BOARD_ID);

  // write to disk to aid debugging
  await fs.writeFile(
    join(__dirname, '../debug.json'),
    JSON.stringify({ ghIssues, ghProjects, trelloBoard }, null, 2),
  );

  //
  // 1. Check that trello has the required columns
  //
  const allGHProjectColumns = new Set(
    Object.values(ghProjects).map((attribute) => attribute.Status),
  );
  for (const ghColumnName of allGHProjectColumns) {
    const trelloColumn = trelloBoard.lists.find(
      (list) => list.name === ghColumnName,
    );
    if (!trelloColumn) {
      console.log(`Creating missing trello column for “${ghColumnName}”…`);
      const newList = await trello.createList({
        idBoard: trelloBoard.board.id,
        name: ghColumnName,
      });
      trelloBoard.lists.push(newList);
    }
  }

  //
  // 2. Check each issue/card matches
  //
  for (const ghIssue of ghIssues) {
    if (ghIssue.pull_request) continue; // skip, this is a PR

    const attributes = ghProjects[ghIssue.number];

    const trelloList = trelloBoard.lists.find(
      (list) => list.name === attributes.Status,
    )!;

    const trelloCard = trelloBoard.cards.find((card) =>
      card.name.startsWith(getTitlePrefix(ghIssue.number)),
    );

    const expectedCard: Trello.Create.NewCard = {
      name: createTrelloTitle(ghIssue),
      desc: createTrelloDescription(ghIssue),
      due: ghIssue.milestone?.due_on || undefined,
      idList: trelloList.id,
      idLabels: [], // TODO:
      idMembers: [], // TODO:
    };

    if (trelloCard) {
      // we found a card. check if all attribute are correct
      const optionsToUpdate: Partial<Trello.Create.NewCard> = {};

      for (const _key in expectedCard) {
        const key = _key as keyof typeof expectedCard;
        const expected = expectedCard[key] || undefined;
        const actual = trelloCard[key] || undefined;
        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
          // @ts-expect-error -- TS is stupid sometimes
          optionsToUpdate[key] = expected;
        }
      }
      const attributesToUpdate = Object.keys(optionsToUpdate);
      if (attributesToUpdate.length) {
        console.log(
          `Updating ${attributesToUpdate.join(', ')} for GH #${
            ghIssue.number
          }…`,
        );
        await trello.updateCard(trelloCard.id, optionsToUpdate);
      }
    } else {
      // no trello card found, so create one
      console.log(`Creating missing trello card for GH #${ghIssue.number}…`);
      const newCard = await trello.createCard(expectedCard);
      trelloBoard.cards.push(newCard);
    }
  }

  console.log('Done');
}

main();
