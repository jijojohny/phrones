/**
 * Add 0G Galileo Testnet to MetaMask (or any injected EIP-1193 wallet).
 * Open this file in a browser with MetaMask installed, or paste into devtools console.
 */
async function add0GGalileoTestnet() {
  if (!window.ethereum) {
    throw new Error('No wallet detected. Install MetaMask first.');
  }

  await window.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [
      {
        chainId: '0x40DA',
        chainName: '0G Galileo Testnet',
        nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
        rpcUrls: ['https://evmrpc-testnet.0g.ai'],
        blockExplorerUrls: ['https://chainscan-galileo.0g.ai'],
      },
    ],
  });

  console.log('0G Galileo Testnet added to wallet.');
}

add0GGalileoTestnet().catch(console.error);
