import { AppCodeUpdater } from 'rake-db';
import * as path from 'path';
import { updateMainFile } from './updateMainFile';
import { updateTableFile } from './updateTableFile/updateTableFile';
import { createBaseTableFile } from './createBaseTableFile';
import { Db, QueryLogOptions } from 'pqb';
import { OrchidORM } from '../orm';
import { updateRelations } from './updateTableFile/updateRelations';

export class AppCodeUpdaterError extends Error {}

export type AppCodeUpdaterConfig = {
  tablePath(tableName: string): string;
  ormPath: string;
  ormExportedAs?: string;
  logger?: QueryLogOptions['logger'];
};

export type BaseTableParam = {
  filePath: string;
  exportAs: string;
};

export type AppCodeUpdaterRelations = {
  [Table in string]: AppCodeUpdaterRelationItem;
};

export type AppCodeUpdaterRelationItem = {
  path: string;
  relations: AppCodeUpdaterRelation[];
};

export type AppCodeUpdaterRelation = {
  kind: 'belongsTo' | 'hasMany';
  className: string;
  path: string;
  columns: string[];
  foreignColumns: string[];
};

export type AppCodeUpdaterTableInfo = {
  key: string;
  name: string;
  path: string;
};

export type AppCodeUpdaterTables = {
  [TableName in string]: AppCodeUpdaterTableInfo;
};

export type AppCodeUpdaterGetTable = (
  tableName: string,
) => Promise<AppCodeUpdaterTableInfo | undefined>;

const makeGetTable = (
  path: string,
  ormExportedAs: string,
  tables: AppCodeUpdaterTables,
): AppCodeUpdaterGetTable => {
  let orm: OrchidORM | undefined;

  return async (tableName) => {
    if (tables[tableName]) return tables[tableName];

    if (!orm) {
      const mod = await import(path).catch((err) => {
        if (err.code === 'ERR_UNKNOWN_FILE_EXTENSION') {
          return require(path);
        } else {
          throw err;
        }
      });

      orm = mod[ormExportedAs];
      if (!orm) {
        throw new Error(`ORM is not exported as ${ormExportedAs} from ${path}`);
      }
    }

    for (const key in orm) {
      const table = orm[key];
      if (
        table &&
        typeof table === 'object' &&
        (table as object) instanceof Db &&
        (table as Db).table === tableName
      ) {
        const tableInfo = {
          key,
          name: (table as { name: string }).name,
          path: (table as { filePath: string }).filePath,
        };
        return (tables[tableName] = tableInfo);
      }
    }

    return;
  };
};

export const appCodeUpdater = ({
  tablePath,
  ormPath,
  ormExportedAs = 'db',
}: AppCodeUpdaterConfig): AppCodeUpdater => ({
  async process({
    ast,
    options,
    basePath,
    cache: cacheObject,
    logger,
    baseTable,
  }) {
    const params: AppCodeUpdaterConfig = {
      tablePath(name: string) {
        const file = tablePath(name);
        return resolvePath(basePath, file);
      },
      ormPath: resolvePath(basePath, ormPath),
      ormExportedAs,
      logger,
    };

    const cache = cacheObject as {
      createdBaseTable?: true;
      relations?: AppCodeUpdaterRelations;
      tables?: AppCodeUpdaterTables;
    };

    cache.relations ??= {};
    cache.tables ??= {};

    const getTable = makeGetTable(params.ormPath, ormExportedAs, cache.tables);

    const promises: Promise<void>[] = [
      updateMainFile(params.ormPath, params.tablePath, ast, options, logger),
      updateTableFile({
        ...params,
        ast,
        baseTable,
        getTable,
        relations: cache.relations,
        tables: cache.tables,
      }),
    ];

    if (!cache.createdBaseTable) {
      promises.push(
        createBaseTableFile({ logger: params.logger, baseTable }).then(() => {
          cache.createdBaseTable = true;
        }),
      );
    }

    await Promise.all(promises);
  },

  async afterAll({ cache, logger }) {
    const { relations } = cache as {
      relations?: AppCodeUpdaterRelations;
    };
    if (!relations) return;

    await updateRelations({
      relations,
      logger,
    });
  },
});

const resolvePath = (basePath: string, filePath: string) =>
  path.isAbsolute(filePath) ? filePath : path.resolve(basePath, filePath);
