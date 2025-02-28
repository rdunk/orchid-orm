import { constructType, JSONType, Primitive, toCode } from './typeBase';
import { singleQuote } from '../../utils';

// JSON literal type
export interface JSONLiteral<T extends Primitive>
  extends JSONType<T, 'literal'> {
  value: Primitive;
}

// constructor of JSON literal type
export const literal = <T extends Primitive>(value: T) =>
  constructType<JSONLiteral<T>>({
    dataType: 'literal',
    value,
    toCode(this: JSONLiteral<T>, t: string) {
      const { value } = this;
      return toCode(
        this,
        t,
        `${t}.literal(${
          typeof value === 'string' ? singleQuote(value) : value
        })`,
      );
    },
  });
