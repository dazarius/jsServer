const { Wallet } = require("ethers");
const { solana } = require("@solana/web3.js");

const createWallet = () => {
  const wallet = Wallet.createRandom();
  return {
    address: wallet.address,

    privateKey: wallet.privateKey,
  };
};

console.log("Wallet created:", createWallet());