import { KittiesSimulator, deriveAccountId, logger } from "./simulators/simulator.js";
import { describe, it, expect } from "vitest";
import * as utils from "./utils/utils";

// Coin public key used only as deployment plumbing (identity is witness-based).
export const deployerCoinPublicKey = utils.toHexPadded("deployer");

const skDeployer = utils.randomBytes(32);
const skAlice = utils.randomBytes(32);
const skBob = utils.randomBytes(32);

const aliceId = deriveAccountId(skAlice);
const bobId = deriveAccountId(skBob);

function newColony(): KittiesSimulator {
  const sim = KittiesSimulator.deploy(skDeployer);
  sim.registerUser("alice", skAlice);
  sim.registerUser("bob", skBob);
  return sim;
}

describe("Midnight Kitties", () => {
  it("deploys with no kitties", () => {
    const l = newColony().getLedger();
    expect(l.totalKitties).toEqual(0n);
    logger.info({ section: "Initial State", total: l.totalKitties });
  });

  it("mints a generation-0 kitty owned by the minter", () => {
    const sim = newColony();
    const l = sim.as("alice").mintKitty();
    expect(l.totalKitties).toEqual(1n);
    expect(utils.bytesEqual(sim.ownerOf(1n), aliceId)).toBe(true);
    expect(sim.balanceOf(aliceId)).toEqual(1n);
    expect(Number(sim.getKitty(1n).generation)).toBe(0);
  });

  it("alternates gender as kitties are born", () => {
    const sim = newColony();
    sim.as("alice").mintKitty();
    sim.as("alice").mintKitty();
    const g1 = sim.getKitty(1n).isMale;
    const g2 = sim.getKitty(2n).isMale;
    expect(g1).not.toEqual(g2);
    expect(sim.balanceOf(aliceId)).toEqual(2n);
    expect(sim.getLedger().totalKitties).toEqual(2n);
  });

  it("transfers a kitty and moves the balances", () => {
    const sim = newColony();
    sim.as("alice").mintKitty(); // kitty 1 -> alice
    sim.as("alice").transferKitty(bobId, 1n);
    expect(utils.bytesEqual(sim.ownerOf(1n), bobId)).toBe(true);
    expect(sim.balanceOf(aliceId)).toEqual(0n);
    expect(sim.balanceOf(bobId)).toEqual(1n);
  });

  it("stops someone transferring a kitty they do not own", () => {
    const sim = newColony();
    sim.as("alice").mintKitty(); // kitty 1 -> alice
    expect(() => sim.as("bob").transferKitty(bobId, 1n)).toThrow("not your kitty");
  });

  it("lists a kitty for sale and lets another account buy it", () => {
    const sim = newColony();
    sim.as("alice").mintKitty(); // kitty 1 -> alice
    sim.as("alice").setPrice(1n, 500n);
    const listed = sim.getKitty(1n);
    expect(listed.forSale).toBe(true);
    expect(listed.price).toEqual(500n);

    sim.as("bob").buyKitty(1n);
    expect(utils.bytesEqual(sim.ownerOf(1n), bobId)).toBe(true);
    expect(sim.getKitty(1n).forSale).toBe(false);
    expect(sim.balanceOf(aliceId)).toEqual(0n);
    expect(sim.balanceOf(bobId)).toEqual(1n);
  });

  it("won't let the owner buy their own listed kitty", () => {
    const sim = newColony();
    sim.as("alice").mintKitty();
    sim.as("alice").setPrice(1n, 100n);
    expect(() => sim.as("alice").buyKitty(1n)).toThrow("already own");
  });

  it("won't sell a kitty that isn't listed", () => {
    const sim = newColony();
    sim.as("alice").mintKitty();
    expect(() => sim.as("bob").buyKitty(1n)).toThrow("not for sale");
  });

  it("breeds two kitties into a next-generation offspring", () => {
    const sim = newColony();
    sim.as("alice").mintKitty(); // 1
    sim.as("alice").mintKitty(); // 2
    sim.as("alice").breed(1n, 2n); // 3
    expect(sim.getLedger().totalKitties).toEqual(3n);
    expect(Number(sim.getKitty(3n).generation)).toBe(1);
    expect(utils.bytesEqual(sim.ownerOf(3n), aliceId)).toBe(true);
    expect(sim.balanceOf(aliceId)).toEqual(3n);
  });

  it("requires owning a parent to breed, and forbids self-breeding", () => {
    const sim = newColony();
    sim.as("alice").mintKitty(); // 1 -> alice
    sim.as("bob").mintKitty();   // 2 -> bob
    expect(() => sim.as("alice").breed(1n, 1n)).toThrow("cannot breed with itself");
    // carol (unregistered as owner of anything) shouldn't be able to breed alice+bob's
    sim.registerUser("carol", utils.randomBytes(32));
    expect(() => sim.as("carol").breed(1n, 2n)).toThrow("must own one of the parents");
  });

  it("reports a clear error for a kitty that doesn't exist", () => {
    const sim = newColony();
    expect(() => sim.ownerOf(99n)).toThrow("no such kitty");
  });
});
