import { DefaultServiceRegistry, UriUtils, type LangiumCoreServices, type URI } from 'langium';

/**
 * Finds the services for a file by the end of its name.
 *
 * Langium looks at the last extension only, which is `.yaml` for `x.migql.yaml`.
 * MigQL must not claim every YAML file, so the whole ending `.migql.yaml` has to match.
 */
export class MigqlServiceRegistry extends DefaultServiceRegistry {

    override getServices(uri: URI): LangiumCoreServices {
        const name = UriUtils.basename(uri);
        for (const [ending, services] of this.fileExtensionMap) {
            if (name.endsWith(ending)) {
                return services;
            }
        }
        return super.getServices(uri);
    }
}
