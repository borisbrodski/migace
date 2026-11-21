import { type DeepPartial, type Module, inject } from 'langium';
import type { LangiumServices, LangiumSharedServices, PartialLangiumServices } from 'langium/lsp';
import { createDefaultModule, createDefaultSharedModule, type DefaultSharedModuleContext } from 'langium/lsp';
import { MigqlGeneratedModule, MigqlGeneratedSharedModule } from './generated/module.js';
import { MigqlTokenBuilder } from './lexer/migql-token-builder.js';
import { MigqlCodeActionProvider } from './lsp/migql-code-action-provider.js';
import { MigqlHoverProvider } from './lsp/migql-hover-provider.js';
import { MigqlLexer } from './lexer/migql-lexer.js';
import { MigqlValidator, registerValidationChecks } from './validation/migql-validator.js';
import { MigqlParserErrorMessageProvider } from './parser/migql-parser-error-message-provider.js';
import { MigqlValueConverter } from './migql-value-converter.js';
import { MigqlIndexManager } from './references/migql-index-manager.js';
import { MigqlLinker } from './references/migql-linker.js';
import { MigqlScopeComputation } from './references/migql-scope-computation.js';
import { MigqlScopeProvider } from './references/migql-scope-provider.js';
import { MigqlServiceRegistry } from './migql-service-registry.js';

export type MigqlAddedServices = {
    validation: {
        MigqlValidator: MigqlValidator
    }
};

export type MigqlServices = LangiumServices & MigqlAddedServices;

export const MigqlModule: Module<MigqlServices, PartialLangiumServices & MigqlAddedServices> = {
    lsp: {
        HoverProvider: services => new MigqlHoverProvider(services),
        CodeActionProvider: () => new MigqlCodeActionProvider(),
    },
    references: {
        Linker: services => new MigqlLinker(services),
        ScopeProvider: services => new MigqlScopeProvider(services),
        ScopeComputation: services => new MigqlScopeComputation(services),
    },
    validation: {
        MigqlValidator: services => new MigqlValidator(services),
    },
    parser: {
        TokenBuilder: () => new MigqlTokenBuilder(),
        Lexer: services => new MigqlLexer(services),
        ValueConverter: () => new MigqlValueConverter(),
        ParserErrorMessageProvider: () => new MigqlParserErrorMessageProvider(),
    },
};

export const MigqlSharedModule: Module<LangiumSharedServices, DeepPartial<LangiumSharedServices>> = {
    ServiceRegistry: services => new MigqlServiceRegistry(services),
    workspace: {
        IndexManager: services => new MigqlIndexManager(services),
    },
};

export function createMigqlServices(context: DefaultSharedModuleContext): {
    shared: LangiumSharedServices,
    migql: MigqlServices
} {
    const shared = inject(createDefaultSharedModule(context), MigqlGeneratedSharedModule, MigqlSharedModule);
    const migql = inject(createDefaultModule({ shared }), MigqlGeneratedModule, MigqlModule);
    shared.ServiceRegistry.register(migql);
    registerValidationChecks(migql);
    if (!context.connection) {
        // Outside a language server nobody sends the configuration.
        shared.workspace.ConfigurationProvider.initialized({});
    }
    return { shared, migql };
}
