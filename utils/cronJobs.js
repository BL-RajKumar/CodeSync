import cron from 'node-cron';
import CollaborationSession from '../models/CollaborationSession.js';

export const initCronJobs = () => {
  console.log('[Cron] Initializing background workers...');

  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('[Cron] Running idle session cleanup job...');
    
    try {
      // Threshold: 60 minutes of inactivity
      const idleThreshold = new Date(Date.now() - 60 * 60 * 1000); 

      // Find sessions that are Active, have NO participants, 
      // AND whose lastActiveAt is older than the threshold
      const idleSessions = await CollaborationSession.find({
        status: 'Active',
        participants: { $size: 0 },
        lastActiveAt: { $lt: idleThreshold }
      });

      if (idleSessions.length > 0) {
        console.log(`[Cron] Found ${idleSessions.length} idle sessions. Terminating...`);
        
        for (const session of idleSessions) {
          session.status = 'Ended';
          session.endedAt = new Date();
          await session.save();
          console.log(`[Cron] Terminated session: ${session.sessionId}`);
        }
      } else {
        console.log('[Cron] No idle sessions found for cleanup.');
      }

    } catch (error) {
      console.error('[Cron] Error during idle session cleanup:', error);
    }
  });
};
