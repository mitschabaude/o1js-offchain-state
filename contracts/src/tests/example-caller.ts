import { Field, PrivateKey, SmartContract, method, Permissions } from "o1js";
import { Storage } from "../Storage.js";
import { zkappAddress } from "../zkapp-utils/local-blockchain.js";

export { ExampleCaller };

let callerKey = PrivateKey.random();
let callerAddress = callerKey.toPublicKey();

class ExampleCaller extends SmartContract {
  static key = callerKey;
  static address = callerAddress;
  static keypair = { key: callerKey, address: callerAddress };

  // can only include account updates for this address with a proof
  // ==> needed to prevent against faking this contract as caller
  init() {
    super.init();
    this.account.permissions.set({
      ...Permissions.default(),
      send: Permissions.proofOrSignature(),
      access: Permissions.proofOrSignature(),
    });
  }

  @method callSet() {
    let storage = new Storage(zkappAddress);
    storage.set(callerAddress, Field(0), Field(0));
  }

  @method callGet() {
    let storage = new Storage(zkappAddress);
    storage.get(callerAddress, Field(0));
  }
}
