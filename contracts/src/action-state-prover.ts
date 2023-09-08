import {
  Field,
  Experimental,
  Provable,
  Struct,
  SelfProof,
  Proof,
  AccountUpdate,
  Bool,
  provablePure,
  ProvablePure,
} from 'o1js';
const { ZkProgram } = Experimental;

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

const actionsPerBatch = 20; // TODO should be a parameter

/**
 * prove that a _dynamic_ number of actions result in `startState` -> `endState`
 *
 * wraps a zk program which recursively adds one batch at a time
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

  for (let i = 0, k = 0; i < nBatches; i++) {
    let batch: Option<Action>[] = [];
    for (let j = 0; j < actionsPerBatch; j++, k++) {
      batch[j] = MaybeAction.from(actions[k]);
    }
    batches[i] = batch;
  }

  if (nBatches === 0) {
    console.log('creating dummy proof...');
    let proof = await ActionStateProver.noBatch(startState);

    return { endState: startState, proof };
  }

  console.log('creating base proof...');
  let proof = await ActionStateProver.firstBatch(startState, batches[0]);

  for (let i = 1; i < nBatches; i++) {
    console.log(`creating proof ${i}...`);
    proof = await ActionStateProver.nextBatch(startState, proof, batches[i]);
  }

  let endState = proof.publicOutput;
  return { endState, proof };
}

let isCompiled = false;

async function compileProver() {
  if (!isCompiled) {
    console.log('compile...');
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
  let actionsHash = AccountUpdate.Actions.hash([Action.toFields(action.value)]);
  let newState = AccountUpdate.Actions.updateSequenceState(state, actionsHash);
  return Provable.if(action.isSome, newState, state);
}

// everything below is internal

const MaybeAction = Option(Action);
const ActionBatch = Provable.Array(MaybeAction, actionsPerBatch);

const ActionStateProver = ZkProgram({
  publicInput: Field, // start action state
  publicOutput: Field, // end action state

  methods: {
    firstBatch: {
      privateInputs: [ActionBatch],

      method(state: Field, batch: Option<Action>[]): Field {
        for (let action of batch) {
          state = update(state, action);
        }
        return state;
      },
    },

    nextBatch: {
      privateInputs: [SelfProof, ActionBatch],

      method(
        startState: Field,
        proofSoFar: Proof<Field, Field>,
        nextBatch: Option<Action>[]
      ): Field {
        proofSoFar.publicInput.assertEquals(startState);
        let state = proofSoFar.publicOutput;
        for (let action of nextBatch) {
          state = update(state, action);
        }
        return state;
      },
    },

    noBatch: {
      privateInputs: [],

      method(state: Field): Field {
        return state;
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
