import { PublicKey } from "@solana/web3.js";
import { rpcConnection } from "./solana.js";
import { db, trackTransaction, updateUser } from "./database.js";
import { bot } from "./index.js";
import { escapeMarkdown } from "./bot.js";

let seenSignatures=new Set();
export async function subscribeToTrackWallet(userId,walletAddress){

    try {
        const targetPubKey = new PublicKey(walletAddress);
        
        const subscriptionId = rpcConnection.onLogs(
          targetPubKey,
          async (logs, context) => {
            try {
    
              if (!logs.signature) return;
              if (seenSignatures.has(logs.signature)) {
                console.log("Signature already processed (dedup):", logs.signature);
                return;
              }
    
              await db.read();
              if (db.data.transactions[logs.signature]) {
                console.log("Signature already processed (DB):", logs.signature);
                seenSignatures.add(logs.signature);
                return;
              }
       
              // Get transaction details with proper error handling
              const tx = await rpcConnection.getTransaction(logs.signature, {
                commitment: 'confirmed'
              }).catch(console.error);
    
              if (!tx || tx.meta?.err) return;
    
              const inlineKeyboard = {
                inline_keyboard: [
                  [
                    { text: '🛑 Stop Tracking', callback_data: `stop_track_${walletAddress}` }
                  ]
                ]
              };
              await bot.telegram.sendMessage(
                userId,
                `${escapeMarkdown('📢 New transaction detected!')}\n\`${escapeMarkdown(logs.signature)}\``,
                { parse_mode: 'MarkdownV2', reply_markup: inlineKeyboard }
              );
              seenSignatures.add(logs.signature);
              await trackTransaction(logs.signature);
            } catch (err) {
              console.error('Log processing error:', err);
            }
          },
          'confirmed'
        );
    
        await updateUser(userId, { 
          subscriptionId,
          copyTarget: walletAddress 
        });
        
        console.log(`Subscribed to ${walletAddress}`);
      } catch (error) {
        console.error('Subscription error:', error);
      }
}