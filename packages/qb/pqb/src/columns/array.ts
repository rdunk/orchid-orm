import { ColumnData, ColumnType } from './columnType';
import { Operators } from './operators';
import { assignMethodsToClass } from './utils';
import {
  arrayMethods,
  addCode,
  Code,
  ColumnTypeBase,
  ArrayMethodsData,
  arrayDataToCode,
} from 'orchid-core';
import { columnCode } from './code';

export type ArrayData<Item extends ColumnTypeBase> = ColumnData &
  ArrayMethodsData & {
    item: Item;
  };

type ArrayMethods = typeof arrayMethods;

export interface ArrayColumn<Item extends ColumnType>
  extends ColumnType<Item['type'][], typeof Operators.array>,
    ArrayMethods {}

export class ArrayColumn<Item extends ColumnType> extends ColumnType<
  Item['type'][],
  typeof Operators.array
> {
  dataType = 'array' as const;
  operators = Operators.array;
  declare data: ArrayData<Item>;

  constructor(item: Item) {
    super();
    this.data.item = item;
  }

  toSQL() {
    return `${this.data.item.toSQL()}[]`;
  }

  toCode(this: ArrayColumn<Item>, t: string): Code {
    const code: Code[] = ['array('];
    addCode(code, this.data.item.toCode(t));
    addCode(code, `)${arrayDataToCode(this.data)}`);
    return columnCode(this, t, code);
  }

  parseFn = Object.assign(
    (input: unknown) => {
      const entries: unknown[] = [];
      parseArray(
        input as string,
        0,
        (input as string).length,
        entries,
        false,
        this.data.item,
      );
      return entries;
    },
    {
      hideFromCode: true,
    },
  );
}

const parseArray = (
  input: string,
  pos: number,
  len: number,
  entries: unknown[],
  nested: boolean,
  item: ColumnType,
): number => {
  if (input[0] === '[') {
    while (pos < len) {
      let char = input[pos++];
      if (char === '\\') {
        char = input[pos++];
      }
      if (char === '=') break;
    }
  }

  let quote = false;
  let start = pos;
  while (pos < len) {
    let char = input[pos++];
    const escaped = char === '\\';
    if (escaped) {
      char = input[pos++];
    }

    if (char === '"' && !escaped) {
      if (quote) {
        pushEntry(input, start, pos, entries, item);
      } else {
        start = pos;
      }
      quote = !quote;
    } else if (char === ',' && !quote) {
      if (start !== pos) {
        pushEntry(input, start, pos, entries, item);
      }
      start = pos;
    } else if (char === '{' && !quote) {
      let array: unknown[];
      let nestedItem = item;
      if (nested) {
        array = [];
        entries.push(array);
        if ('item' in item.data) {
          nestedItem = (item as ArrayColumn<ColumnType>).data
            .item as ColumnType;
        }
      } else {
        array = entries;
      }
      pos = parseArray(input, pos, len, array, true, nestedItem);
      start = pos + 1;
    } else if (char === '}' && !quote) {
      if (start !== pos) {
        pushEntry(input, start, pos, entries, item);
      }
      start = pos + 1;
      break;
    }
  }

  return pos;
};

assignMethodsToClass(ArrayColumn, arrayMethods);

const pushEntry = (
  input: string,
  start: number,
  pos: number,
  entries: unknown[],
  item: ColumnType,
) => {
  let entry: unknown = input.slice(start, pos - 1);
  if (entry === 'NULL') {
    entry = null;
  } else if (item.parseItem) {
    entry = item.parseItem(entry as string);
  }
  entries.push(entry);
};
