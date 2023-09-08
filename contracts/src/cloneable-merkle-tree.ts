// cloneable merkle tree
// fixes MerkleTree to support clone()
// TODO implement for o1's MerkleTree
import { Field, MerkleTree } from 'o1js';

export { CloneableMerkleTree };

class CloneableMerkleTree {
  leaves: Record<string, Field>;
  tree: MerkleTree;

  constructor(height: number) {
    this.tree = new MerkleTree(height);
    this.leaves = {};
  }

  clone() {
    let newTree = new CloneableMerkleTree(this.tree.height);
    for (let [key, value] of Object.entries(this.leaves)) {
      newTree.setLeaf(BigInt(key), value);
    }
    return newTree;
  }

  setLeaf(key: bigint, value: Field) {
    this.tree.setLeaf(key, value);
    this.leaves[key.toString()] = value;
  }
  // TODO should be on o1 MerkleTree
  getLeaf(key: bigint) {
    return this.tree.getNode(0, key);
  }

  getRoot() {
    return this.tree.getRoot();
  }
  getWitness(key: bigint) {
    return this.tree.getWitness(key);
  }
}
