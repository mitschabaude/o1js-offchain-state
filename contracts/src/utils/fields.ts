import { Field, Provable, ProvablePure } from "o1js";
import { assert } from "./utils";
// TODO
import { provableFromClass } from "o1js/dist/node/bindings/lib/provable-snarky.js";

/**
 * A provable type representing an array of fields.
 */
class Fields {
  fields: Field[];

  constructor(fields: Field[]) {
    let size = (this.constructor as typeof Fields).maxLength;

    // assert that data is not too long
    assert(
      fields.length <= size,
      `Expected at most ${size} elements, got ${fields.length}`
    );

    // pad the data with zeros
    let padding = Array.from({ length: size - fields.length }, () => Field(0));
    this.fields = fields.concat(padding);
  }

  /**
   * Coerce the input to {@link Fields}.
   *
   * Inputs smaller than `this.size` are padded with zero fields.
   */
  static from(data: (Field | bigint | number)[] | Fields): Fields {
    if (data instanceof Fields) return data;
    if (this._maxLength === undefined) {
      let Bytes_ = createFields(data.length);
      return Bytes_.from(data);
    }
    return new this(data.map(Field));
  }

  // dynamic subclassing infra
  static _maxLength?: number;
  static _provable?: ProvablePure<Fields>;

  /**
   * The size of the {@link Fields}.
   */
  static get maxLength() {
    assert(this._maxLength !== undefined, "Fields not initialized");
    return this._maxLength;
  }

  get length() {
    return this.fields.length;
  }

  /**
   * `Provable<Fields>`
   */
  static get provable() {
    assert(this._provable !== undefined, "Fields not initialized");
    return this._provable;
  }
}

function createFields(maxLength: number): typeof Fields {
  return class Fields_ extends Fields {
    static _maxLength = maxLength;
    static _provable = provableFromClass(Fields_, {
      fields: Provable.Array(Field, maxLength),
    });
  };
}
