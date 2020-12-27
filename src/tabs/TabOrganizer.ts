import {
    MkToBrowser,
    MkTabOrganizer,
    MkToAddNewGroupParams,
    MkToUpdateGroupTitleParams,
} from './MkTabOrganizer';
import { MkBrowser } from 'src/api/MkBrowser';
import { parseSharedDomain } from 'src/helpers/domainHelpers';

/**
 * Organize open tabs
 */
export class TabOrganizer implements MkTabOrganizer {
    public constructor(browser: MkToBrowser) {
        console.log('TabOrganizer.constructor');
        if (!browser) {
            throw new Error('No browser');
        }
        this.browser = browser;
    }

    private readonly browser: MkToBrowser;

    /**
     * Initialize tab organizer to trigger on extension
     * icon click or automatic tab URL update
     * TODO: Handle funky case where the browser is relaunched and
     * multiple tabs are updating at once causing multiple re-renders
     */
    public init() {
        console.log('TabOrganizer.init');

        // Handle when the extension icon is clicked
        this.browser.action.onClicked.addListener(() => {
            console.log('TabOrganizer.browser.action.onClicked');
            const lastError = this.browser.runtime.lastError;
            if (lastError) {
                throw lastError;
            }
            this.organizeAllTabs();
        });

        // Handle tabs where a URL is updated
        this.browser.tabs.onUpdated.addListener(async (_tabId, changeInfo) => {
            console.log('TabOrganizer.browser.tabs.onUpdated', changeInfo);
            const lastError = this.browser.runtime.lastError;
            if (lastError) {
                throw lastError;
            }
            // We only want automatic sort if enabled
            const isAutomaticSortingEnabled = await this.getEnableAutomaticSorting();
            if (!isAutomaticSortingEnabled) {
                return;
            }
            // TODO: We could only update the order if the domain has changed
            // but this would require keeping track of a tabs previous state
            // which might not be worth the added complexity.
            const hasUrlChanged = !!changeInfo.url;
            if (!hasUrlChanged) {
                return;
            }
            this.organizeAllTabs();
        });
    }

    /**
     * Add new tab groups for a given name and set of tab ids
     * TODO: Find a way to prevent the edit field from showing after a
     * group has been created. Ordering of colors should also be predictable
     * so it doesn't change on every resort.
     */
    private addNewGroup({ idx, name, tabIds }: MkToAddNewGroupParams) {
        console.log('TabOrganizer.addNewGroup', name);
        const options = { tabIds };
        this.browser.tabs.group(options, (groupId) => {
            console.log('TabOrganizer.browser.tabs.group', groupId);
            const lastError = this.browser.runtime.lastError;
            if (lastError) {
                throw lastError;
            }
            const title = `${name} (${tabIds.length})`;
            const color = this.getColorForGroup(idx);
            this.updateGroupTitle({ color, groupId, title });
        });
    }

    /**
     * Get the color based on each index so that each index will
     * retain the same color regardless of a group re-render
     */
    private getColorForGroup(index: number) {
        console.log('TabOrganizer.getColorForGroup', index);
        const colorsByEnum = this.browser.tabGroups.Color;
        console.log('TabOrganizer.getColorForGroup', colorsByEnum);
        const colorKeys = Object.keys(colorsByEnum);
        const colors = colorKeys.map((colorKey) => colorsByEnum[colorKey]);
        const colorIdx = index % colorKeys.length;
        const color = colors[colorIdx];
        console.log('TabOrganizer.getColorForGroup', color);
        return color;
    }

    /**
     * Get the determiner for if we want automatic sorting
     * TODO: This function should be part of a storage/settings service
     */
    private getEnableAutomaticSorting() {
        console.log('TabOrganizer.getEnableAutomaticSorting');
        return new Promise((resolve) => {
            this.browser.storage.sync.get('enableAutomaticSorting', (items) => {
                console.log('TabOrganizer.browser.storage.sync', items);
                const lastError = this.browser.runtime.lastError;
                if (lastError) {
                    throw lastError;
                }
                resolve(items.enableAutomaticSorting);
            });
        });
    }

    /**
     * Group tabs in the browser with the same domain
     */
    private groupBrowserTabs(tabs: MkBrowser.tabs.Tab[]) {
        console.log('TabOrganizer.groupBrowserTabs');
        const tabIdsByDomain = this.sortTabIdsByDomain(tabs);
        this.renderBrowserTabGroups(tabIdsByDomain);
    }

    /**
     * Order all tabs alphabetically
     */
    private organizeAllTabs() {
        console.log('TabOrganizer.orderAllTabs');
        this.browser.tabs.query({}, (tabs) => {
            console.log('TabOrganizer.browser.tabs.query', tabs);
            const lastError = this.browser.runtime.lastError;
            if (lastError) {
                throw lastError;
            }
            const sortedTabs = this.sortTabsAlphabetically(tabs);
            this.reorderBrowserTabs(sortedTabs);
            this.groupBrowserTabs(sortedTabs);
        });
    }

    /**
     * Remove a list of tab ids from any group
     */
    private removeExistingGroup(ids: number[]) {
        console.log('TabOrganizer.removeExistingGroup', ids);
        this.browser.tabs.ungroup(ids, () => {
            console.log('TabOrganizer.browser.tabs.ungroup');
            const lastError = this.browser.runtime.lastError;
            if (lastError) {
                throw lastError;
            }
        });
    }

    /**
     * Set groups and non-groups using their tab id where
     * groups must contain at least two or more tabs
     */
    private renderBrowserTabGroups(tabIdsByGroup: { [key: string]: number[] }) {
        console.log('TabOrganizer.renderBrowserTabGroups', tabIdsByGroup);
        const groups = Object.keys(tabIdsByGroup);
        const isRealGroup = (group: string) => tabIdsByGroup[group].length > 1;
        const realGroups = groups.filter(isRealGroup);
        const orphanGroups = groups.filter((group) => !isRealGroup(group));
        // We treat real groups first so our index used to
        // determine the color isn't affected by orphan groups
        [...realGroups, ...orphanGroups].forEach((group, idx) => {
            const tabIds = tabIdsByGroup[group];
            // Ungroup existing collections of 1
            if (tabIds.length < 2) {
                this.removeExistingGroup(tabIds);
                return;
            }
            this.addNewGroup({ idx, name: group, tabIds });
        });
    }

    /**
     * Reorder browser tabs in the current
     * window according to tabs list
     */
    private reorderBrowserTabs(tabs: MkBrowser.tabs.Tab[]) {
        console.log('TabOrganizer.reorderBrowserTabs', tabs);
        tabs.forEach((tab) => {
            const { id } = tab;
            if (!id) {
                throw new Error(`No id for sorted tab: ${id}`);
            }
            const moveProperties = { index: -1 };
            this.browser.tabs.move(id, moveProperties, () => {
                const lastError = this.browser.runtime.lastError;
                if (lastError) {
                    throw lastError;
                }
            });
        });
    }

    /**
     * Sort tabs by their domain while grouping those that don't
     * have a valid domain under the system nomenclature
     */
    private sortTabIdsByDomain(tabs: MkBrowser.tabs.Tab[]) {
        console.log('TabOrganizer.sortTabIdsByDomain');
        const tabIdsByDomain = {};
        tabs.forEach((tab) => {
            const { url } = tab;
            // Don't group tabs without a URL
            // TODO: Depending on what these are we should reconsider
            if (!url) {
                return;
            }
            const parsedUrl = new URL(url);
            const { hostname } = parsedUrl;
            // For now using system to replace empty strings
            const domain = parseSharedDomain(hostname) || 'system';
            if (!tabIdsByDomain[domain]) {
                tabIdsByDomain[domain] = [tab.id];
            } else {
                tabIdsByDomain[domain].push(tab.id);
            }
        });
        console.log('TabOrganizer.sortTabIdsByDomain', tabIdsByDomain);
        return tabIdsByDomain;
    }

    /**
     * Sort tabs alphabetically using their hostname
     */
    private sortTabsAlphabetically(tabs: MkBrowser.tabs.Tab[]) {
        console.log('TabOrganizer.sortTabsAlphabetically', tabs);
        const sortedTabs = tabs.sort((a, b) => {
            if (!a.url || !b.url) {
                throw new Error('No url for sorted tab');
            }
            // TODO: Handle exception when we try to create a URL object
            // from a URL that isn't supported (eg. chrome://newtab)
            const firstTabUrl = new URL(a.url);
            const firstTabHostname = firstTabUrl.hostname;
            const firstTabDomain = parseSharedDomain(firstTabHostname);
            const secondTabUrl = new URL(b.url);
            const secondTabHostname = secondTabUrl.hostname;
            const secondTabDomain = parseSharedDomain(secondTabHostname);
            return firstTabDomain.localeCompare(secondTabDomain);
        });
        return sortedTabs;
    }

    /**
     * Update an existing groups title
     */
    private updateGroupTitle({
        color,
        groupId,
        title,
    }: MkToUpdateGroupTitleParams) {
        console.log('TabOrganizer.updateGroupTitle');
        const updateProperties = { color, title };
        this.browser.tabGroups.update(groupId, updateProperties, () => {
            console.log('TabOrganizer.browser.tabGroups.update');
            const lastError = this.browser.runtime.lastError;
            if (lastError) {
                throw lastError;
            }
        });
    }
}
