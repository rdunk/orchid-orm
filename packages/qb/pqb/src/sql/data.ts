import { ColumnsParsers, Query, QueryReturnType } from '../query';
import {
  AfterCallback,
  BeforeCallback,
  getValueKey,
  QueryLogger,
  QueryLogObject,
} from '../queryMethods';
import { Adapter, QueryResult } from '../adapter';
import { RelationQueryData, relationQueryKey } from '../relations';
import { ColumnsShape } from '../columns';
import { toSqlCacheKey } from './toSql';
import {
  HavingItem,
  JoinItem,
  OnConflictItem,
  OnConflictMergeUpdate,
  OrderItem,
  SelectItem,
  UnionItem,
  UnionKind,
  WhereItem,
  WindowItem,
  WithItem,
} from './types';
import { Expression } from '../utils';
import {
  RawExpression,
  ColumnsShapeBase,
  ColumnTypeBase,
  MaybeArray,
  Sql,
} from 'orchid-core';
import { QueryBase } from '../queryBase';

export type JoinedShapes = Record<string, ColumnsShapeBase>;
export type JoinedParsers = Record<string, ColumnsParsers>;

export type CommonQueryData = {
  adapter: Adapter;
  shape: ColumnsShapeBase;
  patchResult?(queryResult: QueryResult): Promise<void>;
  handleResult(q: Query, result: QueryResult, isSubQuery?: true): unknown;
  returnType: QueryReturnType;
  [relationQueryKey]?: RelationQueryData;
  wrapInTransaction?: boolean;
  throwOnNotFound?: boolean;
  with?: WithItem[];
  withShapes?: Record<string, ColumnsShape>;
  joinTo?: QueryBase;
  joinedShapes?: JoinedShapes;
  joinedParsers?: JoinedParsers;
  joinedForSelect?: string;
  innerJoinLateral?: true;
  schema?: string;
  select?: SelectItem[];
  as?: string;
  from?: string | Query | RawExpression;
  and?: WhereItem[];
  or?: WhereItem[][];
  coalesceValue?: unknown | RawExpression;
  parsers?: ColumnsParsers;
  notFoundDefault?: unknown;
  defaults?: Record<string, unknown>;
  beforeQuery?: BeforeCallback[];
  afterQuery?: AfterCallback[];
  log?: QueryLogObject;
  logger: QueryLogger;
  autoPreparedStatements?: boolean;
  [toSqlCacheKey]?: Sql;
};

export type SelectQueryData = CommonQueryData & {
  type: undefined;
  distinct?: Expression[];
  fromOnly?: boolean;
  join?: JoinItem[];
  group?: (string | RawExpression)[];
  having?: HavingItem[];
  havingOr?: HavingItem[][];
  window?: WindowItem[];
  union?: { arg: UnionItem; kind: UnionKind; wrap?: boolean }[];
  order?: OrderItem[];
  returnsOne?: true;
  limit?: number;
  offset?: number;
  for?: {
    type: 'UPDATE' | 'NO KEY UPDATE' | 'SHARE' | 'KEY SHARE';
    tableNames?: string[] | RawExpression;
    mode?: 'NO WAIT' | 'SKIP LOCKED';
  };
  // column type for query with 'value' or 'valueOrThrow' return type
  [getValueKey]?: ColumnTypeBase;
};

export type InsertQueryData = CommonQueryData & {
  type: 'insert';
  columns: string[];
  values:
    | unknown[][]
    | MaybeArray<RawExpression>
    | {
        from: Query;
        values?: unknown[][];
      };
  using?: JoinItem[];
  join?: JoinItem[];
  onConflict?:
    | {
        type: 'ignore';
        expr?: OnConflictItem;
      }
    | {
        type: 'merge';
        expr?: OnConflictItem;
        update?: OnConflictMergeUpdate;
      };
  beforeCreate?: BeforeCallback[];
  afterCreate?: AfterCallback[];
};

export type UpdateQueryDataObject = Record<
  string,
  RawExpression | { op: string; arg: unknown } | unknown
>;

export type UpdatedAtDataInjector = (
  data: UpdateQueryDataItem[],
) => UpdateQueryDataItem | void;

export type UpdateQueryDataItem =
  | UpdateQueryDataObject
  | RawExpression
  | UpdatedAtDataInjector;

export type UpdateQueryData = CommonQueryData & {
  type: 'update';
  updateData: UpdateQueryDataItem[];
  beforeUpdate?: BeforeCallback[];
  afterUpdate?: AfterCallback[];
};

export type DeleteQueryData = CommonQueryData & {
  type: 'delete';
  join?: JoinItem[];
  beforeDelete?: BeforeCallback[];
  afterDelete?: AfterCallback[];
};

export type TruncateQueryData = CommonQueryData & {
  type: 'truncate';
  restartIdentity?: boolean;
  cascade?: boolean;
};

export type ColumnInfoQueryData = CommonQueryData & {
  type: 'columnInfo';
  column?: string;
};

export type CopyQueryData = CommonQueryData & {
  type: 'copy';
  copy: CopyOptions;
};

export type CopyOptions<Column = string> = {
  columns?: Column[];
  format?: 'text' | 'csv' | 'binary';
  freeze?: boolean;
  delimiter?: string;
  null?: string;
  header?: boolean | 'match';
  quote?: string;
  escape?: string;
  forceQuote?: Column[] | '*';
  forceNotNull?: Column[];
  forceNull?: Column[];
  encoding?: string;
} & (
  | {
      from: string | { program: string };
    }
  | {
      to: string | { program: string };
    }
);

export type QueryData =
  | SelectQueryData
  | InsertQueryData
  | UpdateQueryData
  | DeleteQueryData
  | TruncateQueryData
  | ColumnInfoQueryData
  | CopyQueryData;

export const cloneQueryArrays = (q: QueryData) => {
  if (q.with) q.with = q.with?.slice(0);
  if (q.select) q.select = q.select?.slice(0);
  if (q.and) q.and = q.and?.slice(0);
  if (q.or) q.or = q.or?.slice(0);
  if (q.beforeQuery) q.beforeQuery = q.beforeQuery?.slice(0);
  if (q.afterQuery) q.afterQuery = q.afterQuery?.slice(0);

  // may have data for updating timestamps on any kind of query
  (q as UpdateQueryData).updateData = (q as UpdateQueryData).updateData?.slice(
    0,
  );

  if (q.type === undefined) {
    if (q.distinct) q.distinct = q.distinct?.slice(0);
    if (q.join) q.join = q.join?.slice(0);
    if (q.group) q.group = q.group?.slice(0);
    if (q.having) q.having = q.having?.slice(0);
    if (q.havingOr) q.havingOr = q.havingOr?.slice(0);
    if (q.window) q.window = q.window?.slice(0);
    if (q.union) q.union = q.union?.slice(0);
    if (q.order) q.order = q.order?.slice(0);
  } else if (q.type === 'insert') {
    q.columns = q.columns?.slice(0);
    q.values = Array.isArray(q.values) ? q.values.slice(0) : q.values;
    if (q.using) q.using = q.using?.slice(0);
    if (q.join) q.join = q.join?.slice(0);
    if (q.beforeCreate) q.beforeCreate = q.beforeCreate?.slice(0);
    if (q.afterCreate) q.afterCreate = q.afterCreate?.slice(0);
  } else if (q.type === 'update') {
    if (q.beforeUpdate) q.beforeUpdate = q.beforeUpdate?.slice(0);
    if (q.afterUpdate) q.afterUpdate = q.afterUpdate?.slice(0);
  } else if (q.type === 'delete') {
    if (q.beforeDelete) q.beforeDelete = q.beforeDelete?.slice(0);
    if (q.afterDelete) q.afterDelete = q.afterDelete?.slice(0);
  }
};
