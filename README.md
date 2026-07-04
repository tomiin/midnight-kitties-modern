# Midnight Kitties (modernized)

A CryptoKitties-style NFT for Midnight, written in Compact. You can mint kitties,
transfer them, list them for sale, buy them, and breed two kitties into a new
generation. It's a small, self-contained contract meant to be read, compiled,
tested, and deployed without fighting a pile of stale dependencies.

## Why this exists

There's an existing `midnight-kitties` project by Ricardo Rius
(https://github.com/riusricardo/midnight-kitties) that the "Your First Contract:
Deploy" quest points at. I went to complete it and hit a wall: it doesn't build
or deploy anymore. Two reasons:

1. It targets **testnet-02, which has been retired.** Nothing you deploy there
   lands anywhere, so the quest as written can't actually be finished.
2. It's pinned to an **old language version** (`language_version >= 0.16.0`) and
   pulls in an **external NFT library** (`midnight-contracts/.../Nft`) built for
   that old compiler. On the current toolchain that dependency doesn't line up.

So instead of poking at a dead thing, I rebuilt it for the current network and
the current compiler, and wrote down exactly what was stale so the next person
doesn't lose the same afternoon.

This is an independent rewrite. The kitty concept, breeding, and marketplace are
inspired by Ricardo's original (GPL-3.0) — credit to him for the idea. The code
here is written from scratch on `language_version >= 0.23`, with the NFT
ownership logic implemented directly in the contract so there's no external
version-pinned library to rot.

## What's different from the original

- Runs on the current Compact language version, no external NFT module.
- NFT primitives (`ownerOf`, `balanceOf`, mint, transfer) are built into the
  contract itself.
- Ownership is **pseudonymous**. In the original, a kitty's owner is a raw public
  key. Here the owner is an *account id* — a one-way hash of a secret key the
  caller proves they hold (a private witness). The kitties, the counts, and the
  sale listings are public; who owns what is only ever a hash. That's selective
  disclosure, which is the whole point of building on Midnight.
- Comes with a passing test suite so you can see it actually works before you
  spend proofs deploying it.

## The concepts it demonstrates

- **Ledger state**: `Map`s and scalars that live on-chain and anyone can read.
- **Witnesses**: private inputs (`localSecretKey`, `randomSeed`) that never touch
  the ledger. The DNA seed is a witness on purpose — it's a nice reminder that
  witness data comes from outside the circuit and the ledger doesn't trust it.
- **`disclose()`**: the explicit "yes, I mean to make this public" you have to
  write whenever a witness- or parameter-derived value gets recorded on-chain.
- **Hash-based identity**: `persistentHash` turns a secret key into a stable,
  public account id without ever revealing the key.
- **A little NFT economy**: minting, ownership, transfers, a for-sale flag, and
  breeding that bumps the generation counter.

## Layout

```
contract/
  src/
    kitties.compact      the contract
    witnesses.ts         private state + witness implementations
    index.ts             package entry point
    test/                simulator + Vitest suite
```

## Run it

You'll need the Midnight Compact toolchain installed (`compact` on your PATH).

```
cd contract
npm install
npm run compact     # compiles kitties.compact -> src/managed/kitties
npm test            # runs the Vitest suite against the compiled contract
```

`npm run compact` pins the compiler to `+0.31.0`. The generated `src/managed/`
output is gitignored on purpose — regenerate it, don't commit it.

## Deploying to testnet

This compiles to a normal Midnight contract, so it deploys the same way any
Compact contract does: drop it into a deploy harness (I used the `example-bboard`
CLI pointed at **Preview** with a local proof server), fund a fresh wallet from
the Preview faucet, register for DUST, and call `mintKitty` / `breed` / etc.
through the deployed contract's `callTx`.

### Deployed on Preview testnet

This contract is live on the public Midnight **Preview** testnet:

- Contract address: `c482622f4e0be2b9fd43b43b817e8d5fbcca4bde7be3245b787cd3373cd2e652`
- Explorer: https://preview.midnightexplorer.com/contracts/0xc482622f4e0be2b9fd43b43b817e8d5fbcca4bde7be3245b787cd3373cd2e652
- Deployment tx: `0x26c12cdbf4f5fa0e938ad551e60ca81a6ba41a28745df3dc77ad7c2aa77103c6` (block #1,454,846, 2026-07-04)

It's not just deployed, it's been used: I minted two kitties and bred them into a
generation-1 offspring, so the on-chain `totalKitties` counter reads 3. The
explorer shows the contract as DEPLOYED, with the deploy transaction, block, and
live ledger state.

### Why Preview and not Preprod?

I actually aimed for Preprod first, because its public explorer indexes contracts
cleanly. The problem: Preprod's wallet sync is currently broken. On every run the
sync balloons memory until Node runs out of heap and crashes (or just stalls),
so the wallet never even sees its funds — you can't get far enough to deploy. I
tried bigger and bigger heaps (up to 16 GB) and manual funding from another
wallet; it still wouldn't converge.

Preview is the opposite. The wallet syncs and deploys cleanly, and its explorer
turned out to render the contract too (see the link above). So Preview is where
this lives, and it is fully public and verifiable there. If Preprod's sync gets
fixed, the exact same contract deploys there unchanged — only the launcher
network differs, nothing in the contract or code.

## Credit

Original concept: `midnight-kitties` by Ricardo Rius (GPL-3.0) —
https://github.com/riusricardo/midnight-kitties. This modernized rebuild is my
own implementation for the current Midnight testnet and compiler.
