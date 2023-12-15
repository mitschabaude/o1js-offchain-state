import { PublicKey, SmartContract, method } from "o1js";

class Storage extends SmartContract {
  @method register(address: PublicKey) {
    throw Error("Method not implemented.");
  }

  @method set(address: PublicKey, key: string, value: string) {
    throw Error("Method not implemented.");
  }

  @method get(address: PublicKey, key: string) {
    throw Error("Method not implemented.");
  }
}
