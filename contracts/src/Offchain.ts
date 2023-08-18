import {
  Field,
  SmartContract,
  State,
  method,
  state,
  MerkleMap,
  MerkleMapWitness,
  MerkleTree,
  Struct,
  PublicKey,
  UInt64,
  Reducer,
  MerkleWitness,
  Poseidon,
  Experimental,
} from 'snarkyjs';

const ActionStateProver = Experimental.ZkProgram({
  publicInput: Field, // start action state
  publicOutput: Field, // end action state

  methods: {
    proveActionState: {
      privateInputs: [],

      method(startState: Field): Field {
        throw Error('todo');
      },
    },
  },
});
class ActionStateProof extends Experimental.ZkProgram.Proof(
  ActionStateProver
) {}

class Key extends Struct([Field, Field]) {}
class Value extends Struct([Field, Field, Field, Field]) {}

let tree = new MerkleTree(256);

class MyMerkleWitness extends MerkleWitness(128) {}

let treeWitness = new MyMerkleWitness(tree.getWitness(100n));

class Event extends Struct({ key: Key, value: Value }) {}

class OffchainState extends SmartContract {
  @state(Field) commitmentRoot = State<Field>();

  events = { set: Event };

  reducer = Reducer({
    actionType: Struct({ keyHash: Field, valueHash: Field }),
  });

  // can be called by anyone to set data on any id
  @method set(key: Key, value: Value) {
    this.emitEvent('set', { key, value });
    // hash key and value
    let keyHash = Poseidon.hash(Key.toFields(key));
    let valueHash = Poseidon.hash(Value.toFields(value));
    this.reducer.dispatch({ keyHash, valueHash });
  }

  // can be called by anyone to settle a fixed number of concurrent updates into the on-chain root
  settleBatch() {}
  @method settleBatchProvable() {}

  // can be called by anyone to provably retrieve data from any id
  @method get(id: Key): Value {
    throw Error('todo');
  }
}
