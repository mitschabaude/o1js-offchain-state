import { AccountUpdate, Mina, PrivateKey, Provable } from 'o1js';
import { Key, OffchainState, Value } from './Offchain.js';
import { compileProver } from './action-state-prover.js';

const proofsEnabled = false;

let Local = Mina.LocalBlockchain({ proofsEnabled });
Mina.setActiveInstance(Local);

let senderKey = Local.testAccounts[0].privateKey;
let sender = senderKey.toPublicKey();

let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

let offchain = new OffchainState(zkappAddress);

// initialize contract
if (proofsEnabled) {
  await compileProver();
  await OffchainState.compile();
}

let tx;

console.log('deploying...');
tx = await Mina.transaction(sender, () => {
  // TODO this API is awkward. why is it under `AccountUpdate`?
  AccountUpdate.fundNewAccount(sender);
  offchain.deploy();
});
await tx.prove();
console.log(tx.toPretty());
await tx.sign([senderKey, zkappKey]).send();

let keys = [];

// set some data
for (let i = 0; i < 7; i++) {
  console.log('set', i, '...');
  let key = Key.random();
  keys.push(key);
  let value = Value.random();

  tx = await offchain.set(sender, key, value);
  console.log(tx.toPretty());
  await tx.sign([senderKey]).send();
}

// settle batch
console.log('settle');
tx = await offchain.settleBatch(sender);
console.log(tx.toPretty());
await tx.sign([senderKey]).send();

// get data
console.log('get');
let key = keys[3];
tx = await Mina.transaction(sender, () => {
  let value = offchain.get(key);
  // do something with value
});
await tx.prove();
console.log(tx.toPretty());
await tx.sign([senderKey]).send();
