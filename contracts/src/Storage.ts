import {
  AccountUpdate,
  Field,
  Mina,
  PublicKey,
  SmartContract,
  TokenId,
  method,
} from "o1js";

export { Storage };

class TODO extends Field {}

class Storage extends SmartContract {
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

  @method set(address: PublicKey, key: TODO, value: TODO) {
    requireCaller(address, this);
  }

  @method get(address: PublicKey, key: TODO) {
    requireCaller(address, this);
  }
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
