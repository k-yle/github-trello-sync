import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { GitHub, getGitHubProjects } from './api/GitHub';
import { Trello } from './api/Trello';
import {
  createTrelloDescription,
  createTrelloTitle,
  extractChecklistItemsFromMarkdown,
  getTitlePrefix,
} from './util/markdown';
import { options } from './options';
import { findTrelloUser } from './util/findTrelloUser';

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
    per_page: 500,
  });
  console.log('Fetching GH Labels');
  const { data: ghLabels } = await github.request(
    'GET /repos/{owner}/{repo}/labels',
    {
      owner: options.GITHUB_REPO_OWENER,
      repo: options.GITHUB_REPO_NAME,
    },
  );

  console.log('Fetching GH Project…');
  const ghProjects = await getGitHubProjects(github);

  console.log('Fetching Trello Board…');
  const trelloBoard = await trello.getBoard(options.TRELLO_BOARD_ID);

  const sourceData = { ghIssues, ghProjects, ghLabels, trelloBoard };

  // write to disk to aid debugging
  await fs.writeFile(
    join(__dirname, '../debug.json'),
    JSON.stringify(sourceData, null, 2),
  );

  console.log(`\nConflating “${trelloBoard.board.name}”\n`);

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
  // 2. Check that trello has the required labels
  //
  for (const ghLabel of ghLabels) {
    const existingLabel = trelloBoard.labels.find(
      (trelloLabel) => ghLabel.name === trelloLabel.name,
    );
    if (!existingLabel) {
      const firstEmptyLabel = trelloBoard.labels.find(
        (label) => label.name === '',
      );
      console.log(`Creating missing trello label for “${ghLabel.name}”…`);
      if (firstEmptyLabel) {
        // there is an unnamed label in trello, so repurpose that
        const updated = await trello.updateLabel(
          firstEmptyLabel.id,
          ghLabel.name,
        );
        const currentIndex = trelloBoard.labels.indexOf(firstEmptyLabel);
        trelloBoard.labels[currentIndex] = updated;
      } else {
        // no unnamed labels in trello, so create a new label
        const newLabel = await trello.createLabel({
          idBoard: trelloBoard.board.id,
          name: ghLabel.name,
          color: 'pink',
        });
        trelloBoard.labels.push(newLabel);
      }
    }
  }

  //
  // 3. Check each issue/card matches
  //
  for (const ghIssue of ghIssues) {
    if (ghIssue.pull_request) continue; // skip, this is a PR

    const attributes = ghProjects[ghIssue.number];

    if (!attributes) continue; // skip, this issue is not in the board

    const trelloList = trelloBoard.lists.find(
      (list) => list.name === attributes.Status,
    )!;

    let trelloCard = trelloBoard.cards.find((card) =>
      card.name.startsWith(getTitlePrefix(ghIssue.number)),
    );

    const expectedCard: Trello.Create.NewCard = {
      name: createTrelloTitle(ghIssue),
      desc: createTrelloDescription(ghIssue, attributes),
      due: ghIssue.milestone?.due_on?.replace('Z', '.000Z') || undefined,
      idList: trelloList.id,
      idLabels: ghIssue.labels
        .map((label) => (typeof label === 'string' ? label : label.name))
        .map(
          (ghLabelName) =>
            trelloBoard.labels.find(
              (trelloLabel) => trelloLabel.name === ghLabelName,
            )!.id,
        ),
      idMembers:
        ghIssue.assignees?.map((ghUser) =>
          findTrelloUser(trelloBoard.members, ghUser),
        ) || [],
    };

    //
    // 3a. create/update card
    //
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
      trelloCard = await trello.createCard(expectedCard);
      trelloBoard.cards.push(trelloCard);
    }

    // we need this line to keep TS happy
    const finalCard = trelloCard;

    //
    // 3b. crete/update checklists on the card
    //
    const ghChecklist = extractChecklistItemsFromMarkdown(ghIssue.body || '');
    const trelloChecklists = trelloBoard.checklists.filter(
      (checklist) => checklist.idCard === finalCard.id,
    );

    if (trelloChecklists.length > 1) {
      // delete any subsequent lists
      for (const trelloChecklist of trelloChecklists.slice(1)) {
        console.log(`Deleting checklist item for GH #${ghIssue.number}…`);
        await trello.deleteChecklist(trelloChecklist.id);
      }
    }

    // ensure that there is exactly 1 checklist for every card
    const mainChecklist =
      trelloChecklists[0] ||
      (await (() => {
        console.log(`Creating checklist for GH #${ghIssue.number}…`);
        return trello.createChecklist({
          idCard: finalCard.id,
          name: 'Checklist',
        });
      })());

    for (const ghChecklistItem of ghChecklist) {
      const trelloItem = mainChecklist.checkItems.find(
        (item) => item.name === ghChecklistItem.label,
      );
      if (trelloItem) {
        // it already exists, so check if the status is correct
        const isTrelloComplete = trelloItem.state === 'complete';
        if (isTrelloComplete !== ghChecklistItem.completed) {
          // need to update the state
          console.log(
            `Updating checklist item status for GH #${ghIssue.number}…`,
          );
          await trello.updateChecklistItem(
            finalCard.id,
            trelloItem.id,
            ghChecklistItem.completed,
          );
        }
      } else {
        // need to create a new item
        console.log(`Creating checklist item for GH #${ghIssue.number}…`);
        const newItem = await trello.createChecklistItem(mainChecklist.id, {
          name: ghChecklistItem.label,
          checked: ghChecklistItem.completed,
        });
        mainChecklist.checkItems.push(newItem);
      }
    }

    // now we need to loop through the trello items and delete any
    // that don't exist in GitHub.
    for (const trelloItem of mainChecklist.checkItems) {
      const ghItem = ghChecklist.find((item) => item.label === trelloItem.name);
      if (!ghItem) {
        // no assosiated github item
        console.log(`Deleting checklist item for GH #${ghIssue.number}…`);
        await trello.deleteChecklistItem(mainChecklist.id, trelloItem.id);
      }
    }
  }

  console.log('Done');
}

main();
