import { Storage } from "../Storage.js";
import {
  Local,
  deploy,
  setDebug,
  transaction,
  zkappAddress,
  otherAddress,
  faucet,
} from "../zkapp-utils/local-blockchain.js";
import assert from "node:assert/strict";
import { ExampleCaller } from "./example-caller.js";

Local.setProofsEnabled(false);
setDebug(true);

await deploy(Storage);
let storage = new Storage(zkappAddress);

// deploy legit caller
await faucet(ExampleCaller.address);
await deploy(ExampleCaller);

// register legit caller
await transaction(
  "register caller",
  () => {
    storage.register(ExampleCaller.address);
  },
  [ExampleCaller.key]
);

// can't register without signature
assert.rejects(
  () =>
    transaction("register no signature", () => storage.register(otherAddress)),
  "required authorization was not provided"
);

await transaction("call set()", () => {
  let caller = new ExampleCaller(ExampleCaller.address);
  caller.callSet();
});
