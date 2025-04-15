import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import 'dotenv/config';


const HELIUS_RPC = `${process.env.deploy=="mainnet"?`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_KEY}`:`https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_KEY}`}`;
// const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_KEY}`;
const rpcConnection = new Connection(HELIUS_RPC, 'confirmed');
console.log("HELIUS rpc ",HELIUS_RPC)
export async function getDetailedWalletInfo(walletAddress) {
  try {
    const pubKey = new PublicKey(walletAddress);
    
    const [balance, tokenAccounts, stakeAccounts, transactions] = await Promise.all([
      rpcConnection.getBalance(pubKey).catch(() => 0),
      rpcConnection.getParsedTokenAccountsByOwner(pubKey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      }).catch(() => ({ value: [] })),
      rpcConnection.getParsedProgramAccounts(
        new PublicKey('Stake11111111111111111111111111111111111111'),
        { filters: [{ memcmp: { offset: 12, bytes: pubKey.toBase58() } }]}
      ).catch(() => []),
      rpcConnection.getSignaturesForAddress(pubKey, { limit: 5 }).catch(() => [])
    ]);

    const tokens = tokenAccounts.value.map(acc => ({
      mint: acc.account.data.parsed.info.mint,
      amount: acc.account.data.parsed.info.tokenAmount.uiAmount,
      decimals: acc.account.data.parsed.info.tokenAmount.decimals,
      isNFT: acc.account.data.parsed.info.tokenAmount.decimals === 0 && 
            acc.account.data.parsed.info.tokenAmount.amount === '1'
    }));
    return {
      solBalance: (balance / LAMPORTS_PER_SOL).toFixed(4),
      tokens: {
        total: tokens.length,
        nfts: tokens.filter(t => t.isNFT).length,
        fungible: tokens.filter(t => !t.isNFT).length
      },
      stakeAccounts: stakeAccounts.length,
      recentTransactions: transactions.map(tx => ({
        signature: tx.signature || 'Unknown',
        blockTime: tx.blockTime || Date.now()/1000,
        status: tx.confirmationStatus || 'confirmed'
      }))
    };

  } catch (err) {
    console.error('RPC Error:', err.message);
    return {
      solBalance: '0.0000',
      tokens: { total: 0, nfts: 0, fungible: 0 },
      stakeAccounts: 0,
      recentTransactions: []
    };
  }
}