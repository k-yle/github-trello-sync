export class Trello {
  private static API_URL = 'https://api.trello.com/1';

  constructor(
    private key: string,
    private token: string,
  ) {}

  private static createUrlQp(options: object) {
    for (const key in options) {
      // @ts-expect-error -- no point typing this
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-dynamic-delete
      if (!options[key]) delete options[key];
    }
    return new URLSearchParams(options as never).toString();
  }

  private async fetch<T extends object>(
    apiEndpoint: string,
    options?: RequestInit,
  ): Promise<T> {
    const separator = apiEndpoint.includes('?') ? '&' : '?';
    const response = await fetch(
      `${Trello.API_URL}${apiEndpoint}${separator}key=${this.key}&token=${this.token}`,
      options,
    );

    const raw = await response.text();

    try {
      const json: T | { message: string } = JSON.parse(raw);
      if ('message' in json) throw new Error(json.message);

      return json;
    } catch {
      console.error(options);
      throw new Error(`${apiEndpoint}: ${raw}`);
    }
  }

  async getBoard(boardId: string) {
    return {
      board: await this.fetch<Trello.Board>(`/boards/${boardId}`),
      lists: await this.fetch<Trello.List[]>(`/boards/${boardId}/lists`),
      cards: await this.fetch<Trello.Card[]>(`/boards/${boardId}/cards`),
      members: await this.fetch<Trello.Member[]>(`/boards/${boardId}/members`),
    };
  }

  async createCard(options: Trello.Create.NewCard): Promise<Trello.Card> {
    return this.fetch(`/cards?${Trello.createUrlQp(options)}`, {
      method: 'POST',
    });
  }

  async updateCard(
    cardId: string,
    options: Partial<Trello.Create.NewCard>,
  ): Promise<Trello.Card> {
    return this.fetch(`/cards/${cardId}?${Trello.createUrlQp(options)}`, {
      method: 'PUT',
    });
  }

  async createList(options: Trello.Create.NewList): Promise<Trello.List> {
    return this.fetch(`/lists?${Trello.createUrlQp(options)}`, {
      method: 'POST',
    });
  }
}

export namespace Trello {
  export interface Board {
    id: string;
    name: string;
    desc: string;
    descData: string;
    closed: boolean;
    idMemberCreator: string;
    idOrganization: string;
    pinned: boolean;
    url: string;
    shortUrl: string;
    prefs: {
      permissionLevel: string;
      hideVotes: boolean;
      voting: string;
      comments: string;
      selfJoin: boolean;
      cardCovers: boolean;
      isTemplate: boolean;
      cardAging: string;
      calendarFeedEnabled: boolean;
      background: string;
      backgroundImage: string;
      backgroundImageScaled: { width: number; height: number; url: string }[];
      backgroundTile: boolean;
      backgroundBrightness: string;
      backgroundBottomColor: string;
      backgroundTopColor: string;
      canBePublic: boolean;
      canBeEnterprise: boolean;
      canBeOrg: boolean;
      canBePrivate: boolean;
      canInvite: boolean;
    };
    labelNames: {
      [labelId: string]: string;
    };
    limits: unknown;
    starred: boolean;
    memberships: string;
    shortLink: string;
    subscribed: boolean;
    powerUps: string;
    dateLastActivity: string;
    dateLastView: string;
    idTags: string;
    datePluginDisable: string;
    creationMethod: string;
    ixUpdate: number;
    templateGallery: string;
    enterpriseOwned: boolean;
  }

  export interface List {
    id: string;
    name: string;
    closed: boolean;
    pos: number;
    softLimit: string;
    idBoard: string;
    subscribed: boolean;
    limits: {
      attachments: {
        perBoard: {
          [key: string]: unknown;
        };
      };
    };
  }

  export interface Card {
    id: string;
    badges: {
      attachmentsByType: { trello: { board: number; card: number } };
      location: boolean;
      votes: number;
      viewingMemberVoted: boolean;
      subscribed: boolean;
      fogbugz: string;
      checkItems: number;
      checkItemsChecked: number;
      checkItemsEarliestDue: null | unknown;
      comments: number;
      attachments: number;
      description: boolean;
      due: null | unknown;
      dueComplete: boolean;
      start: null | unknown;
    };
    checkItemStates: [];
    closed: boolean;
    dueComplete: boolean;
    /** ISO Date */
    dateLastActivity: string;
    desc?: string;
    descData: { emoji: { [emoji: string]: unknown } };
    due: null | unknown;
    dueReminder: number;
    email: null | unknown;
    idBoard: string;
    idChecklists: [];
    idList: string;
    idMembers: string[];
    idMembersVoted: [];
    idShort: number;
    idAttachmentCover: null | unknown;
    labels: Label[];
    idLabels: string[];
    manualCoverAttachment: boolean;
    name: string;
    pos: number;
    shortLink: string;
    shortUrl: string;
    start: null | unknown;
    subscribed: boolean;
    url: string;
    cover: {
      idAttachment: null | unknown;
      color: null | unknown;
      idUploadedBackground: null | unknown;
      size: string;
      brightness: string;
      idPlugin: null | unknown;
    };
    isTemplate: boolean;
    cardRole: null | unknown;
  }

  export interface Label {
    id: string;
    idBoard: string;
    name: string;
    color: string;
    uses: number;
  }

  export interface Member {
    id: string;
    fullName: string;
    username: string;
  }

  export namespace Create {
    export interface NewCard {
      name: string;
      desc?: string;
      due?: string;
      start?: string;
      idList: string;
      idMembers?: string[];
      idLabels?: string[];
    }

    export interface NewList {
      name: string;
      idBoard: string;
    }
  }
}
