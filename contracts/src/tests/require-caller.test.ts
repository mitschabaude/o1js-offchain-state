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
import { AccountUpdate, Field } from "o1js";

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

// legitimate call works
await transaction("call set()", () => {
  let caller = new ExampleCaller(ExampleCaller.address);
  caller.callSet();
});

// can't call without being the caller (first try)
await assert.rejects(
  () =>
    transaction("call set() without being caller 1", () => {
      storage.set(ExampleCaller.address, Field(0), Field(0));
    }),
  (err: any) => {
    assert.match(
      err.message,
      /Top-level account update can not use or pass on token permissions./
    );
    return true;
  }
);

// can't call without being the caller
// even when avoiding the problem that top-level account updates can't use token permissions
await assert.rejects(
  () =>
    transaction("call set() without being caller 2", () => {
      storage.set(ExampleCaller.address, Field(0), Field(0));
      storage.self.body.mayUseToken = AccountUpdate.MayUseToken.No;
    }),
  (err: any) => {
    assert.match(err.message, /Token_owner_not_caller/);
    return true;
  }
);

// can't call without being the caller
// even when trying to match the expected account update structure
await assert.rejects(
  () => {
    return transaction("call set() without being caller 3", () => {
      let wrongTopLevelUpdate = AccountUpdate.create(otherAddress);
      storage.set(ExampleCaller.address, Field(0), Field(0));
      wrongTopLevelUpdate.approve(storage.self);
    });
  },
  (err: any) => {
    assert.match(err.message, /Token_owner_not_caller/);
    return true;
  }
);

// can't call without being the caller
// even when trying to add an account update for the caller
// (but without permissions for that)
await assert.rejects(
  () => {
    return transaction("call set() without being caller 4", () => {
      let unauthorizedUpdate = AccountUpdate.create(ExampleCaller.address);
      storage.set(ExampleCaller.address, Field(0), Field(0));
      unauthorizedUpdate.approve(storage.self);
    });
  },
  (err: any) => {
    // we evaded the token owner not caller problem
    assert.doesNotMatch(err.message, /Token_owner_not_caller/);

    // but are stopped because the account update we added doesn't have authorization
    assert.match(err.message, /Update_not_permitted_access/);
    return true;
  }
);
