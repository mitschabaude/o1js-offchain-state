import {
  Field,
  ZkProgram,
  Provable,
  Struct,
  SelfProof,
  Proof,
  AccountUpdate,
  Bool,
  provablePure,
  ProvablePure,
} from "o1js";

export {
  proveActionState,
  MaybeAction,
  Action,
  ActionStateProof,
  compileProver,
  update,
  updateOutOfSnark,
};

// TODO should be a parameter
type Action = readonly [Field, Field, Field];
const Action: ProvablePure<Action> = provablePure([
  Field,
  Field,
  Field,
] as const);

const actionsPerBatch = 300; // TODO should be a parameter

/**
 * prove that a _dynamic_ number of actions result in `startState` -> `endState`
 *
 * wraps a zk program which recursively adds one batch at a time
 *
 * **important**: the actions are only used to build witness hashes. so, this only proves that _there exists_ a sequence
 * of actions such that we get `endState` from `startState`. it does not prove that exactly these actions were used.
 */
async function proveActionState(
  startState: Field,
  actions: Action[]
): Promise<{ endState: Field; proof: ActionStateProof }> {
  await compileProver();

  // split actions in batches of `actionsPerBatch` each
  let batches: Option<Action>[][] = [];

  let n = actions.length;
  let nBatches = Math.ceil(n / actionsPerBatch);

  // if there are no actions, we still need to create a proof
  if (n === 0) nBatches = 1;

  for (let i = 0, k = 0; i < nBatches; i++) {
    let batch: Option<Action>[] = [];
    for (let j = 0; j < actionsPerBatch; j++, k++) {
      batch[j] = MaybeAction.from(actions[k]);
    }
    batches[i] = batch;
  }

  console.time("dummy");
  let dummy = await ActionStateProof.dummy(Field(0), Field(0), 1, 14);
  console.timeEnd("dummy");

  console.log("creating base proof...");
  console.time("base proof");
  let proof = await ActionStateProver.nextBatch(
    startState,
    dummy,
    Bool(false),
    batches[0],
    Bool(n === 0)
  );
  console.timeEnd("base proof");

  for (let i = 1; i < nBatches; i++) {
    console.log(`creating proof ${i}...`);
    console.time(`proof ${i}`);
    proof = await ActionStateProver.nextBatch(
      startState,
      proof,
      Bool(true),
      batches[i],
      Bool(false)
    );
    console.timeEnd(`proof ${i}`);
  }

  let endState = proof.publicOutput;
  return { endState, proof };
}

let isCompiled = false;

async function compileProver() {
  if (!isCompiled) {
    console.log("compile...");
    await ActionStateProver.compile();
    isCompiled = true;
  }
}

function updateOutOfSnark(state: Field, action?: Action) {
  if (action === undefined) return state;
  let actionsHash = AccountUpdate.Actions.hash([Action.toFields(action)]);
  return AccountUpdate.Actions.updateSequenceState(state, actionsHash);
}

function update(state: Field, action: Option<Action>) {
  let actionsHash = Provable.witness(Field, () =>
    AccountUpdate.Actions.hash([Action.toFields(action.value)])
  );
  let newState = AccountUpdate.Actions.updateSequenceState(state, actionsHash);
  return Provable.if(action.isSome, newState, state);
}

// everything below is internal

const MaybeAction = Option(Action);
const ActionBatch = Provable.Array(MaybeAction, actionsPerBatch);

const ActionStateProver = ZkProgram({
  name: "action-state-prover",
  publicInput: Field, // start action state
  publicOutput: Field, // end action state

  methods: {
    nextBatch: {
      privateInputs: [SelfProof, Bool, ActionBatch, Bool],

      method(
        startState: Field,
        proofSoFar: Proof<Field, Field>,
        isRecursive: Bool,
        nextBatch: Option<Action>[],
        isEmpty: Bool
      ): Field {
        proofSoFar.verifyIf(isRecursive);
        let proofStart = Provable.if(
          isRecursive,
          startState,
          proofSoFar.publicInput
        );
        proofSoFar.publicInput.assertEquals(proofStart);
        let state = Provable.if(
          isRecursive,
          proofSoFar.publicOutput,
          startState
        );
        for (let action of nextBatch) {
          state = update(state, action);
        }
        return Provable.if(isEmpty, startState, state);
      },
    },
  },
});

// TODO: this API is bad. why isn't the Proof already a property (or at least function _on the ZkProgram_?)
class ActionStateProof extends ZkProgram.Proof(ActionStateProver) {}

// provable Option - we should expose this from snarkyjs

type Option<T> = { isSome: Bool; value: T };

function Option<T>(
  type: Provable<T>
): Provable<Option<T>> & { from(value?: T): Option<T> } {
  return class Option_ extends Struct({ isSome: Bool, value: type }) {
    static from(value?: T) {
      return value === undefined
        ? new Option_({ isSome: Bool(false), value: emptyValue(type) })
        : new Option_({ isSome: Bool(true), value });
    }
  };
}

function emptyValue<T>(type: Provable<T>) {
  return type.fromFields(
    Array(type.sizeInFields()).fill(Field(0)),
    type.toAuxiliary()
  );
}
