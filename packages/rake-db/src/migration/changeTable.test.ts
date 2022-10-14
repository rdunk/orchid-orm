import {
  expectSql,
  getDb,
  queryMock,
  resetDb,
  setDbDown,
  toLine,
} from '../test-utils';
import { raw } from 'pqb';

const db = getDb();

describe('changeTable', () => {
  beforeEach(resetDb);

  it('should set comment', async () => {
    const fn = () => {
      return db.changeTable('table', { comment: 'comment' }, () => ({}));
    };

    await fn();
    expectSql(`COMMENT ON TABLE "table" IS 'comment'`);

    setDbDown();
    await fn();
    expectSql(`COMMENT ON TABLE "table" IS NULL`);
  });

  it('should change comment', async () => {
    const fn = () => {
      return db.changeTable('table', { comment: ['old', 'new'] }, () => ({}));
    };

    await fn();
    expectSql(`COMMENT ON TABLE "table" IS 'new'`);

    setDbDown();
    await fn();
    expectSql(`COMMENT ON TABLE "table" IS 'old'`);
  });

  (['add', 'remove'] as const).forEach((action) => {
    it(`should ${action} columns ${
      action === 'add' ? 'to' : 'from'
    } table`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
          id: t[action](t.serial().primaryKey()),
          dropCascade: t[action](t.text(), { dropMode: 'CASCADE' }),
          nullable: t[action](t.text().nullable()),
          nonNullable: t[action](t.text()),
          withDefault: t[action](t.boolean().default(false)),
          withDefaultRaw: t[action](t.date().default(raw(`now()`))),
          withIndex: t[action](
            t.text().index({
              name: 'indexName',
              unique: true,
              using: 'gin',
              expression: 10,
              collate: 'utf-8',
              operator: 'operator',
              order: 'ASC',
              include: 'id',
              with: 'fillfactor = 70',
              tablespace: 'tablespace',
              where: 'column = 123',
            }),
          ),
          uniqueColumn: t[action](t.text().unique({ dropMode: 'CASCADE' })),
          columnWithComment: t[action](
            t.text().comment('this is a column comment'),
          ),
          varcharWithLength: t[action](t.varchar(20)),
          decimalWithPrecisionAndScale: t[action](t.decimal(10, 5)),
          columnWithCompression: t[action](t.text().compression('compression')),
          columnWithCollate: t[action](t.text().collate('utf-8')),
          columnWithForeignKey: t[action](
            t.integer().foreignKey('table', 'column', {
              name: 'fkeyConstraint',
              match: 'FULL',
              onUpdate: 'CASCADE',
              onDelete: 'CASCADE',
            }),
          ),
        }));
      };

      const expectAddColumns = () => {
        expectSql([
          `
            ALTER TABLE "table"
              ADD COLUMN "id" serial PRIMARY KEY,
              ADD COLUMN "dropCascade" text NOT NULL,
              ADD COLUMN "nullable" text,
              ADD COLUMN "nonNullable" text NOT NULL,
              ADD COLUMN "withDefault" boolean NOT NULL DEFAULT false,
              ADD COLUMN "withDefaultRaw" date NOT NULL DEFAULT now(),
              ADD COLUMN "withIndex" text NOT NULL,
              ADD COLUMN "uniqueColumn" text NOT NULL,
              ADD COLUMN "columnWithComment" text NOT NULL,
              ADD COLUMN "varcharWithLength" varchar(20) NOT NULL,
              ADD COLUMN "decimalWithPrecisionAndScale" decimal(10, 5) NOT NULL,
              ADD COLUMN "columnWithCompression" text COMPRESSION compression NOT NULL,
              ADD COLUMN "columnWithCollate" text COLLATE 'utf-8' NOT NULL,
              ADD COLUMN "columnWithForeignKey" integer NOT NULL CONSTRAINT "fkeyConstraint" REFERENCES "table"("column") MATCH FULL ON DELETE CASCADE ON UPDATE CASCADE
          `,
          toLine(`
            CREATE UNIQUE INDEX "indexName"
              ON "table"
              USING gin
              ("withIndex"(10) COLLATE 'utf-8' operator ASC)
              INCLUDE ("id")
              WITH (fillfactor = 70)
              TABLESPACE tablespace
              WHERE column = 123
          `),
          toLine(`
            CREATE UNIQUE INDEX "tableUniqueColumnIndex"
              ON "table"
              ("uniqueColumn")
          `),
          `COMMENT ON COLUMN "table"."columnWithComment" IS 'this is a column comment'`,
        ]);
      };

      const expectRemoveColumns = () => {
        expectSql([
          `
            ALTER TABLE "table"
              DROP COLUMN "id",
              DROP COLUMN "dropCascade" CASCADE,
              DROP COLUMN "nullable",
              DROP COLUMN "nonNullable",
              DROP COLUMN "withDefault",
              DROP COLUMN "withDefaultRaw",
              DROP COLUMN "withIndex",
              DROP COLUMN "uniqueColumn",
              DROP COLUMN "columnWithComment",
              DROP COLUMN "varcharWithLength",
              DROP COLUMN "decimalWithPrecisionAndScale",
              DROP COLUMN "columnWithCompression",
              DROP COLUMN "columnWithCollate",
              DROP COLUMN "columnWithForeignKey"
          `,
          toLine(`DROP INDEX "indexName"`),
          toLine(`DROP INDEX "tableUniqueColumnIndex" CASCADE`),
        ]);
      };

      await fn();
      (action === 'add' ? expectAddColumns : expectRemoveColumns)();

      queryMock.mockClear();
      db.up = false;
      await fn();
      (action === 'add' ? expectRemoveColumns : expectAddColumns)();
    });

    it(`should ${action} composite primary key`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
          ...t[action](t.primaryKey('id', 'name')),
        }));
      };

      const expectAddPrimaryKey = () => {
        expectSql(`
          ALTER TABLE "table"
          ADD PRIMARY KEY ("id", "name")
      `);
      };

      const expectDropPrimaryKey = () => {
        expectSql(`
          ALTER TABLE "table"
          DROP CONSTRAINT "table_pkey"
      `);
      };

      await fn();
      (action === 'add' ? expectAddPrimaryKey : expectDropPrimaryKey)();

      db.up = false;
      queryMock.mockClear();
      await fn();
      (action === 'add' ? expectDropPrimaryKey : expectAddPrimaryKey)();
    });

    it(`should ${action} composite index`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
          ...t[action](
            t.index(['id', { column: 'name', order: 'DESC' }], {
              name: 'compositeIndexOnTable',
              dropMode: 'CASCADE',
            }),
          ),
        }));
      };

      const expectCreateIndex = () => {
        expectSql(`
          CREATE INDEX "compositeIndexOnTable" ON "table" ("id", "name" DESC)
        `);
      };

      const expectDropIndex = () => {
        expectSql(`
          DROP INDEX "compositeIndexOnTable" CASCADE
        `);
      };

      await fn();
      (action === 'add' ? expectCreateIndex : expectDropIndex)();

      db.up = false;
      queryMock.mockClear();
      await fn();
      (action === 'add' ? expectDropIndex : expectCreateIndex)();
    });

    it(`should ${action} composite unique index`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
          ...t[action](
            t.unique(['id', { column: 'name', order: 'DESC' }], {
              name: 'compositeIndexOnTable',
              dropMode: 'CASCADE',
            }),
          ),
        }));
      };

      const expectCreateIndex = () => {
        expectSql(`
          CREATE UNIQUE INDEX "compositeIndexOnTable" ON "table" ("id", "name" DESC)
        `);
      };

      const expectDropIndex = () => {
        expectSql(`
          DROP INDEX "compositeIndexOnTable" CASCADE
        `);
      };

      await fn();
      (action === 'add' ? expectCreateIndex : expectDropIndex)();

      db.up = false;
      queryMock.mockClear();
      await fn();
      (action === 'add' ? expectDropIndex : expectCreateIndex)();
    });

    it(`should ${action} composite foreign key`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
          ...t[action](
            t.foreignKey(
              ['id', 'name'],
              'otherTable',
              ['foreignId', 'foreignName'],
              {
                name: 'constraintName',
                match: 'FULL',
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                dropMode: 'CASCADE',
              },
            ),
          ),
        }));
      };

      const expectedConstraint = toLine(`
        ADD CONSTRAINT "constraintName"
          FOREIGN KEY ("id", "name")
          REFERENCES "otherTable"("foreignId", "foreignName")
          MATCH FULL
          ON DELETE CASCADE
          ON UPDATE CASCADE
      `);

      const expectAddConstraint = () => {
        expectSql(`
          ALTER TABLE "table"
          ${expectedConstraint}
        `);
      };

      const expectDropConstraint = () => {
        expectSql(`
          ALTER TABLE "table"
          DROP CONSTRAINT "constraintName" CASCADE
        `);
      };

      await fn();
      (action === 'add' ? expectAddConstraint : expectDropConstraint)();

      db.up = false;
      queryMock.mockClear();
      await fn();
      (action === 'add' ? expectDropConstraint : expectAddConstraint)();
    });
  });
});
