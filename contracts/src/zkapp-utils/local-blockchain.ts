import {
  AccountUpdate,
  Mina,
  PrivateKey,
  PublicKey,
  SmartContract,
} from "o1js";
import { readZkConfig } from "./zk-config.js";
import assert from "node:assert/strict";

export {
  setDebug,
  setInfo,
  faucet,
  deploy,
  transaction,
  transactionRejects,
  fundAccountCreation,
  Local,
  zkappAddress,
  sender,
  otherAddress,
};

let DEBUG = false;
function setDebug(debug: boolean) {
  DEBUG = debug;
}
let INFO = false;
function setInfo(info: boolean) {
  INFO = info;
}

let Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local);

let { publicKey: sender, privateKey: senderKey } = Local.testAccounts[0];
let { publicKey: otherAddress, privateKey: otherKey } = Local.testAccounts[1];
let { zkappKey, zkappAddress } = await readZkConfig(0);

async function deploy(
  Contract: typeof SmartContract & {
    keypair?: { key: PrivateKey; address: PublicKey };
  }
) {
  let key = Contract.keypair?.key ?? zkappKey;
  let address = Contract.keypair?.address ?? zkappAddress;

  let tx = await Mina.transaction(sender, () => {
    if (!Mina.hasAccount(address)) {
      AccountUpdate.fundNewAccount(sender);
    }
    let contract = new Contract(address);
    contract.deploy();
  });
  if (DEBUG) console.log(tx.toPretty());
  await tx.prove();
  await tx.sign([senderKey, key]).send();
  if (INFO) console.log(`deployed ${Contract.name}`);
}

async function transaction(
  label: string,
  callback: () => void,
  otherSignatures: PrivateKey[] = []
) {
  let tx = await Mina.transaction(sender, callback);
  if (DEBUG) console.log(label, tx.toPretty());
  await tx.prove();
  await tx.sign([senderKey, ...otherSignatures]).send();
  if (INFO) console.log("SUCCESS:", label);
  return tx;
}

async function transactionRejects(
  label: string,
  callback: () => void,
  withError?: string | ((message: string) => void)
) {
  return assert.rejects(
    () => transaction(label, callback),
    (err: any) => {
      if (typeof withError === "string") {
        assert.match(err.message, new RegExp(withError), label);
      } else if (typeof withError === "function") {
        withError(err.message);
      } else {
        console.log(
          label + "\n",
          "transaction correctly rejected with message:",
          err.message
        );
      }
      if (INFO) console.log("FAILED as expected:", label);
      return true;
    }
  );
}

function fundAccountCreation(number = 1) {
  AccountUpdate.fundNewAccount(sender, number);
}

async function faucet(address: PublicKey) {
  return transaction("faucet", () => {
    AccountUpdate.fundNewAccount(sender).send({ to: address, amount: 100e9 });
  });
}
