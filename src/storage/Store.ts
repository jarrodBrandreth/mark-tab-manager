import {
    MkConstructorParams,
    MkLegacyStateKey,
    MkMigrateState,
    MkPotentialState,
    MkPotentialStateKey,
    MkState,
    MkStateKey,
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

        // Promise to resolve when state is loaded
        this.loaded = new Promise((resolve) => {
            this.resolveLoaded = resolve;
        });

        // Set defaults to be overridden
        this.state = this.makeDefaultState();
    }

    private readonly browser: MkStoreBrowser;
    private readonly loaded: Promise<void>;
    private readonly logger: MkLogger;
    private resolveLoaded: (() => void) | null = null;
    private state: MkState;

    /**
     * Fetch valid storage values and set
     * appropriate values in memory for access
     */
    private async cacheStorage() {
        this.logger.log('cacheStorage');
        try {
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
        } catch (error) {
            this.logger.error('cacheStorage', error);
            throw error;
        }
    }

    /**
     * Test and type guard that the key in storage
     * is a valid key that is no longer supported
     */
    private isLegacyKeyValid = (key: string): key is MkLegacyStateKey => {
        this.logger.log('isLegacyKeyValid');
        const legacyState = this.makeLegacyState();
        const legacyStateKeys = Object.keys(legacyState);
        return legacyStateKeys.includes(key);
    };

    /**
     * Test and type guard that the key
     * in storage should be in state
     */
    private isKeyValid = (key: string): key is MkStateKey => {
        this.logger.log('isKeyValid');
        const defaultState = this.makeDefaultState();
        const defaultStateKeys = Object.keys(defaultState);
        return defaultStateKeys.includes(key);
    };

    /**
     * Get the new key name of an old
     * key that has been changed
     */
    private getMigratedKey(key: MkLegacyStateKey) {
        this.logger.log('getMigratedKey', key);
        const migratedKeyByLegacy = {
            enableAutomaticSorting: 'enableAlphabeticSorting',
        } as const;
        const migratedKey = migratedKeyByLegacy[key];
        if (!migratedKey) {
            return null;
        }
        return migratedKey;
    }

    /**
     * Retrieve the current in memory state
     */
    public async getState(): Promise<MkState> {
        this.logger.log('getState');
        // Wait for the initial data load
        await this.loaded;
        this.logger.log('getState', this.state);
        return this.state;
    }

    /**
     * Load existing sync storage into memory cache
     * and provide defaults for what hasn't been set
     */
    public async load(): Promise<void> {
        this.logger.log('load');
        await this.cacheStorage();
        // Indicate storage is loaded for
        // anyone who depends on it
        if (!this.resolveLoaded) {
            throw new Error('Resolve loaded not set');
        }
        this.resolveLoaded();
    }

    /**
     * Provide expected defaults for what our memory
     * store and persistent storage should contain
     */
    private makeDefaultState() {
        this.logger.log('makeDefaultState');
        return {
            clusterGroupedTabs: true,
            enableAutomaticGrouping: true,
            enableAlphabeticSorting: true,
            enableSubdomainFiltering: false,
            forceWindowConsolidation: false,
        };
    }

    /**
     * Collection of legacy keys that may exist in a users storage
     * and their original default values for reference
     */
    private makeLegacyState() {
        this.logger.log('makeLegacyState');
        return {
            enableAutomaticSorting: true,
        };
    }

    /**
     * Migrate any settings under old key
     * names to their new key name
     */
    private migrateState({ keys, state }: MkMigrateState) {
        this.logger.log('migrateState', keys);
        const migratedState: Partial<MkState> = {};
        const legacyStateKeys = keys.filter(this.isLegacyKeyValid);
        legacyStateKeys.forEach((legacyStateKey) => {
            const migratedKey = this.getMigratedKey(legacyStateKey);
            // We might not have a valid
            // key that we can migrate
            if (!migratedKey) {
                return;
            }
            migratedState[migratedKey] = state[legacyStateKey];
        });
        this.logger.log('migrateState', migratedState);
        return migratedState;
    }

    /**
     * Parse valid values for top-level state only without
     * checking if the types of values are what we expect.
     * Migrate any key names that maybe have changed.
     */
    private parseValidState(state: string) {
        this.logger.log('parseValidState', state);
        if (!state) {
            throw new Error('No state to parse');
        }
        // TODO: Avoid unsafe casting to what we expect
        const parsedState = JSON.parse(state) as MkPotentialState;
        // TODO: Avoid unsafe casting to make TS happy
        const stateKeys = Object.keys(parsedState) as MkPotentialStateKey[];
        // Migrate any keys where the name may have changed
        const validParsedState: Partial<MkState> = {};
        const validStateKeys = stateKeys.filter(this.isKeyValid);
        validStateKeys.forEach((validStateKey) => {
            validParsedState[validStateKey] = parsedState[validStateKey];
        });
        this.logger.log('parseValidState', validParsedState);
        // Migrating any previously named values during parsing without
        // immediately persisting means we rely on the setting of state
        // later to persist a migration change and can't assume everyone
        // who has this specific version has their migration persisted.
        const migratedState = this.migrateState({
            keys: stateKeys,
            state: parsedState,
        });
        const validState: Partial<MkState> = {
            ...validParsedState,
            ...migratedState,
        };
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
        this.logger.log('setState', state);
        try {
            // Wait for the initial data load
            await this.loaded;
            // Best to set in memory state immediately instead of relying on
            // storage updated event so we can be sure our state is accurate
            // at the right time when it may be accessed.
            const internalState = this.setInternalState(state);
            const serializedState = JSON.stringify(internalState);
            this.logger.log('setState', serializedState);
            const items = { settings: serializedState };
            await this.browser.storage.sync.set(items);
        } catch (error) {
            this.logger.error('setState', error);
            throw error;
        }
    }
}
