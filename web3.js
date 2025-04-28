const { Wallet } = require("ethers");
const { ethers } = require("ethers");
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');




async function dayliclaim(
  contractAddress,
  contractABI,
  rpc,
  privateKey,
  address

) {

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, contractABI, wallet);
  const price = await contract.Price();

  console.log("original price", price);
  console.log("daily claim price", ethers.formatEther(price));
  const tx = await contract.dailyClaim({ value: price });
  const receipt = await tx.wait();

  if (receipt.status === 1) {
    const totalCost = price + receipt.gasUsed;
    console.log("total cost", totalCost);

    let count = await contract.getClaimInfo(address);
    
    // const event = receipt.logs.find(
    //   (log) => log.address.toLowerCase() === contract.target.toLowerCase()
    // );
    // let c = event.args[1].toString();
    // console.log("event", event);
    // console.log("total claim", c);
    


    // );
    return {
      status: "claimed",
      tx: receipt.hash,
      gasUsed:  ethers.formatEther(totalCost).toString(),
      totalClaimed: count.toString(),  
      channelID: "1361785389999849717", 
      channelName: "daily-claim",


    }
  }
  else{
    console.log(await contract.getClaimInfo(address));
      return {
        status: "Transaction failed",
      }

  }
 

}



async function customContract(
  contract,
  abi,
  func,
  rpc,
  privateKey,
  args,
  
){
  // console.log("`customContract web3js","contract", contract
  // , "abi", abi, "func", func, "rpc", rpc, "privateKey", privateKey, "args", args);
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(privateKey, provider);
  const c = new ethers.Contract(contract, abi, wallet);
   console.log("contract", wallet.address);  
  if(args[0] === "0") {
    args = [];
  }
  const arg = args.map((a) => {
    if(String(a).includes("0x")) {
      return a;
    }
    if(String(a).includes(".")) {

      return ethers.parseUnits(a, 18);
    }
    return BigInt(a)
  })
  console.log("args", args);
  

  
  try {
    // console.log(`Call ${func} with args:`, args);

    const fragment = c.interface.getFunction(func);
    if (!fragment) throw new Error(`Function ${func} not found in contract`);

    let result;

    if (fragment.stateMutability === "view" || fragment.stateMutability === "pure") {
      result = await c[func](...arg);
      // if (typeof result === "bigint") {
      //   result = ethers.formatUnits(result, 18);
      // } 
      console.log("📖 View result:", result);
      return {
        status: "view",
        result: result,
      };
    } else {
      const tx = await c[func](...arg);
      result = await tx.wait();

      if (result.status === 1) {
        console.log("✅ Custom transaction  success:", result);
        return{
          status: "success",
          tx: result.hash || result.blockHash,
          blockNumber: result.blockNumber,
          gasUsed: ethers.formatEther(result.gasUsed).toString(),
        }
      }
      else if (result.status !== 1) {
        return {
          status: "Transaction failed",
          
        }
      }
      
      console.log("✅ Transaction success:", result);
    }
    
    return result;

  } catch (err) {
    console.log("❌ Error in web3js:", err);
    return { error: err.reason || err.message || "Unknown error" };
  }
}







// Преобразует Uint8Array приватник в base58 (для Phantom импорта)
function encodePrivateKey(uint8array) {
  return bs58.encode(uint8array);
}

// Обратное: из base58 приватника получаем Uint8Array
function decodePrivateKey(base58Str) {
  return bs58.decode(base58Str);
}


// generare EVM/SOL wallet
const createWallet = () => {
  const wallet = Wallet.createRandom();
  const solanaWallet = Keypair.generate();

  return {
    address: {
      ethereum: wallet.address,
      solana: solanaWallet.publicKey.toString(),
    },
    privateKey: {
      ethereum: wallet.privateKey,
      solana: encodePrivateKey(solanaWallet.secretKey),
    },
  };
};












exports.customContract = customContract;
exports.dayliclaim = dayliclaim;
exports.createWallet = createWallet;
