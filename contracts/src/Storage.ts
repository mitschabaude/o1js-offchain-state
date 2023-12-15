import {
  AccountUpdate,
  Field,
  Mina,
  Provable,
  PublicKey,
  Reducer,
  SmartContract,
  State,
  Struct,
  TokenId,
  method,
  state,
} from "o1js";
import { assert } from "./utils/utils";

export { Storage };

class TODO extends Field {}

class Storage extends SmartContract {
  reducer = Reducer({ actionType: TODO });

  @state(Field) commitmentRoot = State<Field>();
  @state(Field) currentActionState = State<Field>();

  register(address: PublicKey) {
    let caller = AccountUpdate.createSigned(address);
    this.registerProvable(address);
    caller.approve(this.self);
    caller.balance.subInPlace(Mina.accountCreationFee());
  }
  @method registerProvable(address: PublicKey) {
    requireSignature(address);
    requireCaller(address, this);
  }

  @method set(address: PublicKey, key: Field, value: TODO) {
    requireCaller(address, this);
  }

  @method get(address: PublicKey, key: Field) {}
}

function requireSignature(address: PublicKey) {
  AccountUpdate.createSigned(address);
}

function requireCaller(address: PublicKey, contract: SmartContract) {
  contract.self.body.mayUseToken = AccountUpdate.MayUseToken.ParentsOwnToken;
  let update = AccountUpdate.create(contract.address, TokenId.derive(address));
  update.body.mayUseToken = AccountUpdate.MayUseToken.InheritFromParent;
  return update;
}

const VALUE_SIZE = 16;

class Value extends Struct({ array: Provable.Array(Field, VALUE_SIZE) }) {
  constructor(array: Field[]) {
    assert(array.length === VALUE_SIZE);
    super({ array });
  }

  static random() {
    return new Value([
      Field.random(),
      Field.random(),
      Field.random(),
      Field.random(),
    ]);
  }
}
