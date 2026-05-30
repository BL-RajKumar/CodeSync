import Notification from '../models/Notification.js';

let ioInstance = null;

/**
 * Store the Socket.IO instance globally to enable easy broadcasts.
 */
export const setIoInstance = (io) => {
  ioInstance = io;
};

/**
 * Centralized service to create, persist, and dispatch notifications in real-time.
 */
export const createNotification = async ({
  recipientId,
  actorId,
  type,
  title,
  message,
  relatedId = null,
  relatedType = null,
}) => {
  try {
    // Prevent self-notifications
    if (recipientId.toString() === actorId.toString()) {
      return null;
    }

    // 1. Persist notification in Database
    const notification = await Notification.create({
      recipientId,
      actorId,
      type,
      title,
      message,
      relatedId,
      relatedType,
    });

    // Populate actor details for client-side rendering
    const populated = await Notification.findById(notification._id)
      .populate('actorId', 'username email avatarUrl')
      .exec();

    const notificationJSON = populated.toJSON();

    // 2. Dispatch real-time WebSocket events if socket instance is set
    if (ioInstance) {
      const recipientRoom = `user:${recipientId.toString()}`;
      
      // Calculate updated unread count for badge
      const unreadCount = await Notification.countDocuments({
        recipientId,
        isRead: false,
      });

      // Emit events to recipient's private user room
      ioInstance.to(recipientRoom).emit('new-notification', notificationJSON);
      ioInstance.to(recipientRoom).emit('unread-count', { unreadCount });
      
      console.log(`[Notification Service] Dispatched live WebSocket event to room '${recipientRoom}' (Unread: ${unreadCount})`);
    } else {
      console.warn('[Notification Service] Warning: Socket.IO instance not initialized in service.');
    }

    // 3. Dispatch simulated Email alert (Spec: dispatches and persists email alerts)
    sendMockEmail({
      recipientId: recipientId.toString(),
      title,
      message,
    });

    return notificationJSON;
  } catch (error) {
    console.error('[Notification Service] Error creating notification:', error);
    return null;
  }
};

/**
 * Professional email dispatch simulator.
 */
const sendMockEmail = ({ recipientId, title, message }) => {
  console.log(`
========================================================================
📧 [MOCK EMAIL ALERT SYSTEM]
Recipient User ID: ${recipientId}
Subject: [CodeSync Alert] ${title}
------------------------------------------------------------------------
Hi there,

We have detected a new activity in your CodeSync workspace:

"${message}"

Log in to your dashboard to review this updates.

Best regards,
The CodeSync Team
========================================================================
  `);
};
