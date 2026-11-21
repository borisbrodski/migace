import { DefaultIndexManager } from 'langium';

/**
 * A snippet can become wrong without being touched: another snippet takes its slug or its uid,
 * or a part it refers to disappears. After a change the checks therefore run again for every
 * snippet of the project. They are cheap, because no file is parsed again.
 */
export class MigqlIndexManager extends DefaultIndexManager {

    override isAffected(): boolean {
        return true;
    }
}
