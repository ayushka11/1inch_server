require('dotenv').config();
const { Wallet, Contract, providers } = require("ethers");

async function mintTokens() {
  const provider = new providers.JsonRpcProvider("http://127.0.0.1:8545");
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);

  const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base fork
  const btcAddress  = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"; // BTC (WBTC) on fork

  const erc20Abi = [
    "function balanceOf(address) view returns(uint256)", 
    "function mint(address to, uint256 amount)"
  ];

  const usdc = new Contract(usdcAddress, erc20Abi, wallet);
  const btc  = new Contract(btcAddress, erc20Abi, wallet);

  const usdcAmount = 1_000_000; // 1 USDC (6 decimals)
  const btcAmount  = "100000000"; // 1 BTC (8 decimals)

  // Mint tokens
  const usdcTx = await usdc.mint(wallet.address, usdcAmount);
  await usdcTx.wait();
  
  const btcTx = await btc.mint(wallet.address, btcAmount);
  await btcTx.wait();

  console.log("USDC balance:", (await usdc.balanceOf(wallet.address)).toString());
  console.log("BTC balance:", (await btc.balanceOf(wallet.address)).toString());
}

mintTokens().catch(console.error);