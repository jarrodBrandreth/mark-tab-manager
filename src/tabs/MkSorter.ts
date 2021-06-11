import { MkStore } from 'src/storage/MkStore';
import { MkLoggerConstructor } from 'src/logs/MkLogger';
import { MkBrowser } from 'src/api/MkBrowser';
import { MkTabIdsByGroup } from './MkGrouper';

export interface MkSorter {
    render(tabs: MkBrowser.tabs.Tab[]): Promise<void>;
    filter(tabs: MkBrowser.tabs.Tab[]): MkBrowser.tabs.Tab[];
    sort(params: MkSortParams): Promise<MkBrowser.tabs.Tab[]>;
}

export interface MkContstructorParams {
    store: MkStore;
    Logger: MkLoggerConstructor;
}

export interface MkClusterParams {
    tabGroups: MkTabIdsByGroup;
    tabs: MkBrowser.tabs.Tab[];
}

export interface MkSortParams {
    groups: MkTabIdsByGroup;
    tabs: MkBrowser.tabs.Tab[];
}
