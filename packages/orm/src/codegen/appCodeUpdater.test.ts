import { appCodeUpdater, AppCodeUpdaterConfig } from './appCodeUpdater';
import { asMock, ast } from './testUtils';
import { updateMainFile } from './updateMainFile';
import path from 'path';
import { updateTableFile } from './updateTableFile/updateTableFile';
import { createBaseTableFile } from './createBaseTableFile';
import { updateRelations } from './updateTableFile/updateRelations';

jest.mock('./updateMainFile', () => ({
  updateMainFile: jest.fn(),
}));

jest.mock('./updateTableFile/updateTableFile', () => ({
  updateTableFile: jest.fn(),
}));

jest.mock('./createBaseTableFile', () => ({
  createBaseTableFile: jest.fn(() => Promise.resolve()),
}));

jest.mock('./updateTableFile/updateRelations', () => ({
  updateRelations: jest.fn(),
}));

const params: AppCodeUpdaterConfig = {
  tablePath: (table: string) => `tables/${table}.ts`,
  ormPath: 'db.ts',
  logger: console,
  ormExportedAs: 'db',
};

describe('appCodeUpdater', () => {
  beforeEach(jest.clearAllMocks);

  const baseTable = {
    filePath: 'baseTable.ts',
    exportAs: 'BaseTable',
  };

  const fn = appCodeUpdater(params);

  it('should call table and file updaters with proper arguments', async () => {
    await fn.process({
      ast: ast.addTable,
      options: {},
      basePath: __dirname,
      cache: {},
      logger: console,
      baseTable,
    });

    const ormPath = path.resolve(__dirname, params.ormPath);
    const tablePath = path.resolve(__dirname, params.tablePath('table'));

    const main = asMock(updateMainFile).mock.calls[0];
    expect(main[0]).toBe(ormPath);
    expect(main[1]('table')).toBe(tablePath);
    expect(main[2]).toBe(ast.addTable);

    const [table] = asMock(updateTableFile).mock.calls[0];
    expect(table.tablePath('table')).toBe(tablePath);
    expect(table.baseTable).toBe(baseTable);
    expect(table.ormPath).toBe(ormPath);

    const [base] = asMock(createBaseTableFile).mock.calls[0];
    expect(base.baseTable).toBe(baseTable);
  });

  it('should call createBaseTable only on first call', async () => {
    const cache = {};
    expect(createBaseTableFile).not.toBeCalled();

    await fn.process({
      ast: ast.addTable,
      options: {},
      basePath: __dirname,
      cache,
      logger: console,
      baseTable,
    });

    expect(createBaseTableFile).toBeCalledTimes(1);

    await fn.process({
      ast: ast.addTable,
      options: {},
      basePath: __dirname,
      cache,
      logger: console,
      baseTable,
    });

    expect(createBaseTableFile).toBeCalledTimes(1);
  });

  it('should call updateRelations in afterAll', async () => {
    const relations = {};

    await fn.afterAll({
      options: {},
      basePath: __dirname,
      cache: { relations },
      logger: console,
      baseTable,
    });

    expect(updateRelations).toBeCalledWith({
      relations,
      logger: console,
    });
  });
});
