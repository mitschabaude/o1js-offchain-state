import { AccountUpdate, Mina, SmartContract } from "o1js";
import { readZkConfig } from "./zk-config";

export { deploy };

let Local = Mina.LocalBlockchain({ proofsEnabled: true });
Mina.setActiveInstance(Local);

let { publicKey: sender, privateKey: senderKey } = Local.testAccounts[0];
let { zkappKey, zkappAddress } = await readZkConfig(0);

async function deploy(Contract: typeof SmartContract) {
  let tx = await Mina.transaction(sender, () => {
    AccountUpdate.fundNewAccount(sender);
    let contract = new Contract(zkappAddress);
    contract.deploy();
  });
  await tx.prove();
  await tx.sign([senderKey, zkappKey]).send();
}
