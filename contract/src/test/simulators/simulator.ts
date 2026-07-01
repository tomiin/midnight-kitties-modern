import { createLogger } from "../../logger.js";
import { LogicTestingConfig } from "../../config.js";
import { deployerCoinPublicKey } from "../kitties.test.js";

import {
  Contract,
  type Ledger,
  type Kitty,
  ledger,
  pureCircuits
} from "../../managed/kitties/contract/index.js";
import {
  type KittiesPrivateState,
  createKittiesPrivateState,
  witnesses
} from "../../witnesses.js";

import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  createConstructorContext,
  CostModel,
  CircuitResults,
  ContractAddress
} from "@midnight-ntwrk/compact-runtime";

const config = new LogicTestingConfig();
export const logger = await createLogger(config.logDir);

export const deriveAccountId = (secretKey: Uint8Array): Uint8Array =>
  pureCircuits.accountId(secretKey);

export class KittiesSimulator {
  readonly contract: Contract<KittiesPrivateState>;
  circuitContext: CircuitContext<KittiesPrivateState>;
  userPrivateStates: Record<string, KittiesPrivateState>;
  updateUserPrivateState: (newPrivateState: KittiesPrivateState) => void;
  contractAddress: ContractAddress;

  constructor(privateState: KittiesPrivateState) {
    this.contract = new Contract<KittiesPrivateState>(witnesses);
    this.contractAddress = sampleContractAddress();
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState
    } = this.contract.initialState(
      createConstructorContext(privateState, deployerCoinPublicKey)
    );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      currentQueryContext: new QueryContext(
        currentContractState.data,
        this.contractAddress
      ),
      costModel: CostModel.initialCostModel()
    };
    this.userPrivateStates = { ["deployer"]: currentPrivateState };
    this.updateUserPrivateState = (_n: KittiesPrivateState) => {};
  }

  static deploy(deployerSecretKey: Uint8Array): KittiesSimulator {
    return new KittiesSimulator(createKittiesPrivateState(deployerSecretKey));
  }

  registerUser(name: string, secretKey: Uint8Array): void {
    this.userPrivateStates[name] = createKittiesPrivateState(secretKey);
  }

  private buildTurnContext(
    currentPrivateState: KittiesPrivateState
  ): CircuitContext<KittiesPrivateState> {
    return { ...this.circuitContext, currentPrivateState };
  }

  private updateUserPrivateStateByName =
    (name: string) =>
    (newPrivateState: KittiesPrivateState): void => {
      this.userPrivateStates[name] = newPrivateState;
    };

  as(name: string): KittiesSimulator {
    const ps = this.userPrivateStates[name];
    if (!ps) throw new Error(`No private state for '${name}'. Register them first.`);
    this.circuitContext = this.buildTurnContext(ps);
    this.updateUserPrivateState = this.updateUserPrivateStateByName(name);
    return this;
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  private updateStateAndGetLedger<T>(
    results: CircuitResults<KittiesPrivateState, T>
  ): Ledger {
    this.circuitContext = results.context;
    this.updateUserPrivateState(results.context.currentPrivateState);
    return this.getLedger();
  }

  // ---- state-changing circuits ----

  public mintKitty(): Ledger {
    const r = this.contract.impureCircuits.mintKitty(this.circuitContext);
    logger.info({ section: "mintKitty", gasCost: r.gasCost });
    return this.updateStateAndGetLedger(r);
  }

  public transferKitty(to: Uint8Array, kittyId: bigint): Ledger {
    const r = this.contract.impureCircuits.transferKitty(this.circuitContext, to, kittyId);
    logger.info({ section: "transferKitty", gasCost: r.gasCost });
    return this.updateStateAndGetLedger(r);
  }

  public setPrice(kittyId: bigint, price: bigint): Ledger {
    const r = this.contract.impureCircuits.setPrice(this.circuitContext, kittyId, price);
    logger.info({ section: "setPrice", gasCost: r.gasCost });
    return this.updateStateAndGetLedger(r);
  }

  public buyKitty(kittyId: bigint): Ledger {
    const r = this.contract.impureCircuits.buyKitty(this.circuitContext, kittyId);
    logger.info({ section: "buyKitty", gasCost: r.gasCost });
    return this.updateStateAndGetLedger(r);
  }

  public breed(kittyId1: bigint, kittyId2: bigint): Ledger {
    const r = this.contract.impureCircuits.breed(this.circuitContext, kittyId1, kittyId2);
    logger.info({ section: "breed", gasCost: r.gasCost });
    return this.updateStateAndGetLedger(r);
  }

  // ---- read circuits ----

  public ownerOf(kittyId: bigint): Uint8Array {
    const r = this.contract.impureCircuits.ownerOf(this.circuitContext, kittyId);
    this.circuitContext = r.context;
    return r.result;
  }

  public balanceOf(account: Uint8Array): bigint {
    const r = this.contract.impureCircuits.balanceOf(this.circuitContext, account);
    this.circuitContext = r.context;
    return r.result;
  }

  public getKitty(kittyId: bigint): Kitty {
    const r = this.contract.impureCircuits.getKitty(this.circuitContext, kittyId);
    this.circuitContext = r.context;
    return r.result;
  }

  public getAllKittiesCount(): bigint {
    const r = this.contract.impureCircuits.getAllKittiesCount(this.circuitContext);
    this.circuitContext = r.context;
    return r.result;
  }
}
