import { group } from '../group';
import { groupMock } from '../mocks/group';

describe('tabs/group', () => {
    const originalChrome = global.chrome;

    beforeEach(() => {
        // Mocking requires any assertion for setting tabGroups
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.chrome as any) = {
            tabs: {
                group: groupMock,
            },
            runtime: {},
        };
    });
    afterEach(() => {
        global.chrome = originalChrome;
    });

    it('should throw when group is lacking support', () => {
        // Setting tabGroups requires any
        // eslint-disable-next-line
        (global.chrome as any).tabs.group = undefined;
        global.chrome.runtime.lastError = undefined;
        const options = { tabIds: [1] };
        expect(() => {
            void group(options);
        }).toThrow('No tabs.group support');
    });

    it('should resolve with group id after tab ids are grouped', async () => {
        global.chrome.runtime.lastError = undefined;
        const options = { tabIds: [1] };
        const groupId = await group(options);
        expect(groupId).toBe(2);
    });

    it('should reject with error if one exists', async () => {
        global.chrome.runtime.lastError = {
            message: 'error',
        };
        const options = { tabIds: [1] };
        await expect(group(options)).rejects.toMatchObject({
            message: 'error',
        });
    });
});