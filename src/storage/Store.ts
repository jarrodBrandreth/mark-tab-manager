import {
    MkConstructorParams,
    MkState,
    MkStore,
    MkStoreBrowser,
} from './MkStore';
import { MkLogger } from 'src/logs/MkLogger';

/**
 * Loading, caching, and setting storage
 * TODO: Store should specify a "GenericStorage"
 * port and be passed a "SyncStorage" adapter
 */
export class Store implements MkStore {
    public constructor({ browser, Logger }: MkConstructorParams) {
        if (!browser) {
            throw new Error('No browser');
        }
        this.browser = browser;

        if (!Logger) {
            throw new Error('No Logger');
        }
        this.logger = new Logger('Store');
        this.logger.log('constructor');

        // Set defaults to be overridden
        this.state = this.makeDefaultState();
    }

    private readonly browser: MkStoreBrowser;
    private readonly logger: MkLogger;
    private state: MkState;

    /**
     * Load existing sync storage into memory cache
     * and provide defaults for what hasn't been set
     */
    public async load(): Promise<void> {
        this.logger.log('load');
        await this.cacheStorage();
    }

    /**
     * Fetch valid storage values and set
     * appropriate values in memory for access
     */
    private async cacheStorage() {
        this.logger.log('cacheStorage');
        const { storage } = this.browser;
        const { settings } = await storage.sync.get('settings');
        this.logger.log('cacheStorage', settings);
        // If there is no storage we don't cache anything
        if (typeof settings === 'undefined') {
            return;
        }
        if (typeof settings !== 'string') {
            throw new Error('Invalid settings storage');
        }
        const validState = this.parseValidState(settings);
        this.setInternalState(validState);
    }

    /**
     * Whether the key in storage should be in state
     */
    private isKeyValid(key: string) {
        this.logger.log('isKeyValid');
        const defaultState = this.makeDefaultState();
        const defaultStateKeys = Object.keys(defaultState);
        return defaultStateKeys.includes(key);
    }
    /**
     * Retrieve the current in memory state
     */
    public getState(): Promise<MkState> {
        this.logger.log('getState', this.state);
        return Promise.resolve(this.state);
    }

    /**
     * Provide expected defaults for what our memory
     * store and persistent storage should contain
     */
    private makeDefaultState() {
        this.logger.log('makeDefaultState');
        return {
            enableAutomaticSorting: true,
        };
    }

    /**
     * Parse valid values for top-level state only without
     * checking if the types of values are what we expect
     */
    private parseValidState(state: string) {
        this.logger.log('parseValidState', state);
        if (!state) {
            throw new Error('No state to parse');
        }
        // TODO: Avoid unsafe casting to what we expect
        const parsedState = JSON.parse(state) as MkState;
        // TODO: Avoid unsafe casting to make TS happy
        const stateKeys = Object.keys(parsedState) as (keyof MkState)[];
        const validState: Partial<MkState> = {};
        stateKeys.forEach((stateKey) => {
            const isKeyValid = this.isKeyValid(stateKey);
            if (!isKeyValid) {
                return;
            }
            validState[stateKey] = parsedState[stateKey];
        });
        this.logger.log('parseValidState', validState);
        return validState;
    }

    /**
     * Update the current in memory state where state is currently
     * expected to be only one level and not support deep copies
     */
    private setInternalState(internalState: Partial<MkState>) {
        this.logger.log('setInternalState', internalState);
        const state = {
            ...this.state,
            ...internalState,
        };
        this.state = state;
        return state;
    }

    /**
     * Store a value directly in persistent storage
     */
    public async setState(state: Partial<MkState>): Promise<void> {
        this.logger.log('setState');
        // Best to set in memory state immediately instead of relying on on
        // storage updated event so we can be sure our state is accurate at
        // the right time when it may be accessed.
        const internalState = this.setInternalState(state);
        const serializedState = JSON.stringify(internalState);
        const items = { settings: serializedState };
        await this.browser.storage.sync.set(items);
    }
}