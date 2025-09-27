require('dotenv').config();
const ethers = require("ethers");
const { Wallet, providers, Contract } = ethers;
const fs = require("fs");

// --- ERC20 ABI fragment ---
const erc20AbiFragment = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];

// --- Provider & Wallet ---
const provider = new providers.JsonRpcProvider("http://127.0.0.1:8545");
const wallet = new Wallet(process.env.PRIVATE_KEY, provider);

async function deployTestToken(name, symbol) {
  const artifact = JSON.parse(fs.readFileSync("./out/TestToken.sol/TestToken.json", "utf8"));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const token = await factory.deploy(name, symbol);
  await token.deployTransaction.wait();
  console.log(`${name} deployed at:`, token.address);
  return token.address;
}

async function main() {
  console.log("Wallet address:", wallet.address);

  // Deploy tokens
  const usdcAddress = await deployTestToken("Test USDC", "tUSDC");
  const btcAddress = await deployTestToken("Test BTC", "tBTC");

  // Create contracts
  const usdcContract = new Contract(usdcAddress, erc20AbiFragment, wallet);
  const btcContract = new Contract(btcAddress, erc20AbiFragment, wallet);

  // Mint tokens
  await usdcContract.mint(wallet.address, ethers.utils.parseUnits("1000", 18));
  await btcContract.mint(wallet.address, ethers.utils.parseUnits("1", 18));

  // Check balances
  const usdcBalance = await usdcContract.balanceOf(wallet.address);
  const btcBalance = await btcContract.balanceOf(wallet.address);

  console.log("USDC Balance:", ethers.utils.formatUnits(usdcBalance, 18));
  console.log("BTC Balance:", ethers.utils.formatUnits(btcBalance, 18));

  console.log("Token deployment and minting successful!");
}

main().catch(console.error);