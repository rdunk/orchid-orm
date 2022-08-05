import { SelectQueryData } from './types';
import { expressionToSql } from './common';

export const pushDistinctSql = (
  sql: string[],
  distinct: Exclude<SelectQueryData['distinct'], undefined>,
  quotedAs?: string,
) => {
  sql.push('DISTINCT');

  if (distinct.length) {
    const columns: string[] = [];
    distinct?.forEach((item) => {
      columns.push(expressionToSql(item, quotedAs));
    });
    sql.push(`ON (${columns.join(', ')})`);
  }
};
