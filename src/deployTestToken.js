require('dotenv').config();
const { ethers } = require("ethers");
const fs = require("fs");

async function main() {
    const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Read compiled ABI + bytecode
    const artifact = JSON.parse(fs.readFileSync("./out/TestToken.sol/TestToken.json", "utf8"));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    
    // Deploy with token name & symbol
    const token = await factory.deploy("Test BTC", "tBTC");
    await token.deployTransaction.wait();

    console.log("Deployed TestToken at:", token.address);
}

main().catch(console.error);