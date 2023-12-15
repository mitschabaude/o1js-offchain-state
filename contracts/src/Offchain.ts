import {
  Field,
  SmartContract,
  State,
  method,
  state,
  Struct,
  PublicKey,
  Reducer,
  MerkleWitness,
  Poseidon,
  Encoding,
  Provable,
  Mina,
} from "o1js";
import {
  Action,
  ActionStateProof,
  proveActionState,
  updateOutOfSnark,
} from "./action-state-prover.js";
import { CloneableMerkleTree } from "./cloneable-merkle-tree.js";

export { OffchainState, Key, Value };

type tup = [] | [any, ...any];

class Key extends Struct([Field, Field] satisfies tup) {
  static random() {
    return new Key([Field.random(), Field.random()]);
  }
}
class Value extends Struct([Field, Field, Field, Field] satisfies tup) {
  static random() {
    return new Value([
      Field.random(),
      Field.random(),
      Field.random(),
      Field.random(),
    ]);
  }
}
class Event extends Struct({ key: Key, value: Value, uid: Field }) {}

// simulate monitoring events and correlating them to actions
let offchainMap = new Map<bigint, { key: Key; value: Value }>();
let onchainMap = new Map<bigint, Value>();

let treeHeight = 256;
let onchainTree = new CloneableMerkleTree(treeHeight);

class MyMerkleWitness extends MerkleWitness(treeHeight) {}

const batchSize = 5;

class OffchainState extends SmartContract {
  @state(Field) commitmentRoot = State<Field>();
  @state(Field) currentActionState = State<Field>();

  events = { set: Event };

  reducer = Reducer({ actionType: Action });

  init() {
    super.init();
    this.currentActionState.set(Reducer.initialActionState);
    this.commitmentRoot.set(onchainTree.getRoot());
  }

  // can be called by anyone to set data on any id
  async set(sender: PublicKey, key: Key, value: Value) {
    // random id to correlate actions and values
    let uid = Field.random();

    // update offchain data
    offchainMap.set(uid.toBigInt(), { key, value });

    // call contract method to set via an action
    // (w/ proof for remaining endpoint as auxiliary input, to connect with the current on-chain action state)
    let tx = await Mina.transaction(sender, () => {
      this.setProvable(key, value, uid);
    });
    await tx.prove();
    return tx;
  }

  @method setProvable(key: Key, value: Value, uid: Field) {
    this.emitEvent("set", { key, value, uid });

    // hash key and value, dispatch to reducer
    let keyCommitment = hashwithPrefix("key", Key.toFields(key));
    let valueCommitment = hashwithPrefix("value", Value.toFields(value));
    this.reducer.dispatch([keyCommitment, valueCommitment, uid]);
  }

  // can be called by anyone to settle a fixed number of concurrent updates into the on-chain root
  // returns a transaction
  async settleBatch(sender: PublicKey) {
    let state = this.currentActionState.get();

    // fetch actions starting at the current action state
    let actions = (
      await this.reducer.fetchActions({ fromActionState: state })
    ).map(([action]) => action); // we only dispatch 1 action per account update

    // compute action state after `batchSize` actions
    // (this handles if we have less than `batchSize` actions)
    for (let i = 0; i < batchSize; i++) {
      state = updateOutOfSnark(state, actions[i]);
    }

    // create proof for the remaining actions
    let { proof } = await proveActionState(state, actions.slice(batchSize));

    // call contract method to process `batchSize` actions
    // (w/ proof for remaining endpoint as auxiliary input, to connect with the current on-chain action state)
    let tx = await Mina.transaction(sender, () => {
      this.settleBatchProvable(proof);
    });
    await tx.prove();

    // update onchain tree and map
    for (let i = 0; i < batchSize; i++) {
      let action = actions[i];
      if (action === undefined) break;
      let [keyCommitment, valueCommitment, uid] = action;
      let event = offchainMap.get(uid.toBigInt());
      if (event === undefined) throw Error("event not found");
      onchainMap.set(keyCommitment.toBigInt(), event.value);
      onchainTree.setLeaf(keyCommitment.toBigInt(), valueCommitment);
    }

    return tx;
  }

  @method settleBatchProvable(proof: ActionStateProof) {
    // get actions from current action state to the state where the proof starts
    let fromActionState = this.currentActionState.getAndAssertEquals();
    let endActionState = proof.publicInput;

    let actions = this.reducer.getActions({ fromActionState, endActionState });

    // assert that we have `batchSize` actions or less
    if (actions.length > batchSize) throw Error("unexpected # of actions");

    let tmpTree = onchainTree.clone();

    // process `batchSize` actions
    let { state, actionState } = this.reducer.reduce(
      actions,
      Field,
      (root, [keyCommitment, valueCommitment, _uid]) => {
        let isDummy = keyCommitment.equals(0);

        let oldValueCommitment = Provable.witness(Field, () =>
          tmpTree.getLeaf(keyCommitment.toBigInt())
        );
        let witness = Provable.witness(MyMerkleWitness, () => {
          return new MyMerkleWitness(
            tmpTree.getWitness(keyCommitment.toBigInt())
          );
        });

        // prove that the witness is correct, by comparing the implied root and key
        witness.calculateIndex().assertEquals(keyCommitment);
        witness.calculateRoot(oldValueCommitment).assertEquals(root);

        // store new value commitment in tree at key commitment
        let newRoot = witness.calculateRoot(valueCommitment);

        // also update the tree! (not part of the circuit)
        Provable.asProver(() => {
          // ignore dummy value
          if (isDummy.toBoolean()) return;
          tmpTree.setLeaf(keyCommitment.toBigInt(), valueCommitment);
        });

        return Provable.if(isDummy, root, newRoot);
      },
      {
        state: this.commitmentRoot.getAndAssertEquals(),
        actionState: fromActionState,
      },
      {
        maxTransactionsWithActions: batchSize,
        skipActionStatePrecondition: true,
      }
    );
    // assert that the proof picks off where our batch ended
    actionState.assertEquals(endActionState);

    // verify proof
    proof.verify();

    // assert that the proof's end state matches the onchain action state
    this.account.actionState.assertEquals(proof.publicOutput);

    // update on-chain state
    this.commitmentRoot.set(state);
    this.currentActionState.set(actionState);
  }

  // can be called by anyone to provably retrieve data from any id
  @method get(key: Key): Value {
    let keyCommitment = hashwithPrefix("key", Key.toFields(key));

    let value = Provable.witness(Value, () => {
      let value = onchainMap.get(keyCommitment.toBigInt());
      if (value === undefined) throw Error("key not found");
      return value;
    });

    let valueCommitment = hashwithPrefix("value", Value.toFields(value));

    // prove that (key, value) are in the merkle tree
    let witness = Provable.witness(MyMerkleWitness, () => {
      return new MyMerkleWitness(
        onchainTree.getWitness(keyCommitment.toBigInt())
      );
    });
    witness.calculateIndex().assertEquals(keyCommitment);
    witness
      .calculateRoot(valueCommitment)
      .assertEquals(this.commitmentRoot.getAndAssertEquals());

    return value;
  }
}

// TODO this function needs to be exported
function hashwithPrefix(prefix: string, input: Field[]) {
  let initialState = Poseidon.update(
    Poseidon.initialState(),
    Encoding.stringToFields(prefix)
  ) as [Field, Field, Field]; // TODO type bug

  return Poseidon.update(initialState, input)[0];
}
