/**
 * Run with npx tsc && node, not jest
 */
import { Field, Reducer } from "o1js";
import {
  proveActionState,
  Action,
  compileProver,
} from "./action-state-prover.js";
import { expect } from "expect";
import { describe, it } from "node:test";

function randomActions(n: number) {
  let actions: Action[] = [];
  for (let i = 0; i < n; i++) {
    actions[i] = [Field.random(), Field.random(), Field.random()];
  }
  return actions;
}

console.time("compile");
await compileProver();
console.timeEnd("compile");

await describe("test action state prover", async () => {
  let state = Reducer.initialActionState;

  await it("does 0 actions", async () => {
    let startState = state;

    console.time("prove");
    let { endState, proof } = await proveActionState(startState, []);
    console.timeEnd("prove");

    expect(endState).toEqual(startState);
    expect(proof.publicInput).toEqual(startState);
    expect(proof.publicOutput).toEqual(endState);
    state = endState;
  });

  await it("does 500 actions", async () => {
    let startState = state;

    console.time("prove");
    let { endState, proof } = await proveActionState(
      startState,
      randomActions(500)
    );
    console.timeEnd("prove");

    expect(endState).not.toEqual(startState);
    expect(proof.publicInput).toEqual(startState);
    expect(proof.publicOutput).toEqual(endState);
    state = endState;
  });
});
