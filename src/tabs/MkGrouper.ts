import { MkStore } from 'src/storage/MkStore';
import { MkLoggerConstructor } from 'src/logs/MkLogger';
import { MkBrowser } from 'src/api/MkBrowser';
import { MkOrganizerType } from './MkOrganizer';

export interface MkGrouper {
    group(tabs: MkBrowser.tabs.Tab[]): Promise<MkTabIdsByGroup>;
    isEnabled(): Promise<boolean>;
    isSupported(): boolean;
    remove(): Promise<void>;
    render(params: MkRender): void;
}

export interface MkConstructorParams {
    store: MkStore;
    Logger: MkLoggerConstructor;
}

export interface MkAddNewGroupParams {
    idx: number;
    forceCollapse: boolean;
    name: string;
    tabIds: number[];
    windowId: number;
}

export interface MkGetGroupInfoParams {
    title: string;
    id: number;
}

export type MkActiveTabIdsByWindowKey = number;
export type MkActiveTabIdsByWindowValue = number | undefined;
export type MkActiveTabIdsByWindow = Map<number, number | undefined>;

export interface MkTabIdsByGroup {
    [key: string]: Record<string, number[]>;
}

export interface MkRenderGroupsByNameParams {
    activeTabIdsByWindow: MkActiveTabIdsByWindow;
    type: MkOrganizerType;
    tabIdsByGroup: MkTabIdsByGroup;
}

export interface MkRender {
    groups: MkTabIdsByGroup;
    organizeType: MkOrganizerType;
    tabs: MkBrowser.tabs.Tab[];
}

export interface MkUpdateGroupTitleParams {
    collapsed: boolean;
    color: string;
    groupId: number;
    title: string;
}
