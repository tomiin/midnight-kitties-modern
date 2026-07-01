// Private state + witnesses for the Midnight Kitties contract.
//
// Two hidden inputs are needed:
//   - localSecretKey: the caller's identity key. The on-chain owner is
//     persistentHash([secretKey]); the key itself is never disclosed.
//   - randomSeed: fresh entropy used to derive a kitty's DNA. It is a witness
//     precisely to make the point that witness data is supplied from OUTSIDE
//     the circuit and is not trusted by the ledger.
export type KittiesPrivateState = {
  secretKey: Uint8Array;
};

export const createKittiesPrivateState = (secretKey: Uint8Array): KittiesPrivateState => {
  return { secretKey };
};

type WitnessContext<T> = {
  privateState: T;
};

const freshRandom = (): Uint8Array => {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
};

export const witnesses = {
  localSecretKey: (
    context: WitnessContext<KittiesPrivateState>,
  ): [KittiesPrivateState, Uint8Array] => {
    return [context.privateState, context.privateState.secretKey];
  },
  randomSeed: (
    context: WitnessContext<KittiesPrivateState>,
  ): [KittiesPrivateState, Uint8Array] => {
    return [context.privateState, freshRandom()];
  },
};
