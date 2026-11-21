import { DefaultScopeProvider, type ReferenceInfo, type Scope } from 'langium';
import { isNameRef } from '../generated/ast.js';
import { letDefinitions } from './names.js';

export class MigqlScopeProvider extends DefaultScopeProvider {

    override getScope(context: ReferenceInfo): Scope {
        if (isNameRef(context.container)) {
            return this.createScopeForNodes(letDefinitions(context.container));
        }
        return super.getScope(context);
    }
}
