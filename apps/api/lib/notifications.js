const notificationsStore = new Map();
let sequence = 1;

function addNotification(userId, message) {
  const current = notificationsStore.get(userId) || [];
  const next = [{ id: sequence++, message, read: false, createdAt: new Date().toISOString() }, ...current];
  notificationsStore.set(userId, next);
}

function getNotifications(userId) {
  return notificationsStore.get(userId) || [];
}

function markRead(userId, id) {
  const updated = getNotifications(userId).map((item) => (item.id === id ? { ...item, read: true } : item));
  notificationsStore.set(userId, updated);
}

module.exports = {
  addNotification,
  getNotifications,
  markRead,
};
