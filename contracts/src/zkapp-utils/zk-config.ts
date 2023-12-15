import fs from "fs/promises";
import { PrivateKey, PublicKey } from "o1js";

export { readZkConfig };

// parse config and private key from file
type Config = {
  deployAliases: Record<
    string,
    {
      url: string;
      keyPath: string;
      fee: string;
      feepayerKeyPath: string;
      feepayerAlias: string;
    }
  >;
};

let configJson: Config = JSON.parse(await fs.readFile("config.json", "utf8"));

async function readZkConfig(label: string | number) {
  let config =
    typeof label === "string"
      ? configJson.deployAliases[label]
      : Object.values(configJson.deployAliases)[label];

  let { url, fee } = config;

  // read keys
  let feepayerKeysBase58: { privateKey: string; publicKey: string } =
    JSON.parse(await fs.readFile(config.feepayerKeyPath, "utf8"));
  let feepayerKey = PrivateKey.fromBase58(feepayerKeysBase58.privateKey);
  let feepayerAddress = PublicKey.fromBase58(feepayerKeysBase58.publicKey);

  let zkAppKeysBase58: { privateKey: string; publicKey: string } = JSON.parse(
    await fs.readFile(config.keyPath, "utf8")
  );
  let zkappKey = PrivateKey.fromBase58(zkAppKeysBase58.privateKey);
  let zkappAddress = PublicKey.fromBase58(zkAppKeysBase58.publicKey);

  return { url, fee, feepayerKey, feepayerAddress, zkappKey, zkappAddress };
}
