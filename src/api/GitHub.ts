import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/parameters-and-response-types';
import type { components } from '@octokit/openapi-types';
import { options } from '../options';

/* eslint-disable import/export -- deliberately merging namespace with class */
export { Octokit as GitHub } from 'octokit';

export namespace GitHub {
  export type Issue =
    RestEndpointMethodTypes['issues']['listForRepo']['response']['data'][number];

  export type User = components['schemas']['simple-user'];

  export interface Milestone {
    /** ISO Date */
    dueOn: string;
    description: string;
    number: number;
    title: string;
    resourcePath: string;
  }

  export interface LinkedPRs {
    nodes: { number: number; permalink: string; title: string }[];
  }

  export interface ProjectAttributes {
    // these attribute names are special
    Title: string;
    Status: string;
    Milestone?: GitHub.Milestone;
    'Linked pull requests'?: LinkedPRs;

    // all other attribute names are user-defined
    [attributeName: string]:
      | string
      | number
      | GitHub.Milestone
      | GitHub.LinkedPRs
      | undefined;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- this API only supports graphql… */
export async function getGitHubProjects(
  github: GitHub,
): Promise<{ [issueNumber: number]: GitHub.ProjectAttributes }> {
  const result: any = await github.graphql(
    await fs.readFile(join(__dirname, './graphql/projectId.gql'), 'utf8'),
    {
      owner: options.GITHUB_REPO_OWENER,
      projectNumber: +options.GITHUB_PROJECT_NUMBER,
    },
  );
  const projectId: string = result.organization.projectV2.id;

  const projectInfo: any = await github.graphql(
    await fs.readFile(join(__dirname, './graphql/projectInfo.gql'), 'utf8'),
    { projectId },
  );

  const ghProjectInfo: any = {};

  for (const node of projectInfo.node.items.nodes) {
    const issueNumber = node.content.number;
    ghProjectInfo[issueNumber] ||= {};

    for (const attribute of node.fieldValues.nodes) {
      if (attribute.field) {
        ghProjectInfo[issueNumber][attribute.field.name] =
          attribute.text ||
          attribute.name ||
          attribute.number ||
          attribute.pullRequests ||
          attribute.milestone;
      }
    }
  }

  return ghProjectInfo;
}
