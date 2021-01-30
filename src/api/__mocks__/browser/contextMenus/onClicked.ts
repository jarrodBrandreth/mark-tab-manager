import { listeners } from 'src/api/__mocks__/listeners';
import { MkBrowser } from 'src/api/MkBrowser';

export function onClicked(info: MkBrowser.contextMenus.OnClickedData): void {
    const { onClickedListeners } = listeners.contextMenus;
    onClickedListeners.forEach((onClickedListener) => {
        const tab = {} as MkBrowser.tabs.Tab;
        onClickedListener(info, tab);
    });
}
