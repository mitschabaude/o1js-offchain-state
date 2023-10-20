# o1js-offchain-state

here I want to experiment with the viability of different large state architectures in [zkApps on Mina](https://docs.minaprotocol.com/zkapps).

there are three possible paradigms:

- offchain state commited to in onchain state
- using actions as a sort of builtin offchain state
- using the manager contract feature ("tokens") to manage state in 1 account per user

the first one is the cheapest and most general, so I started with that - designing contracts that would make L1 apps scale to a large user base
