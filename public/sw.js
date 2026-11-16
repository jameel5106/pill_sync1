// PillSync Production Service Worker - Offline-First & Alarm Delivery Engine
const CACHE_NAME = 'pillsync-v1.3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg'
];

// Install: precache app shell & critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[PillSync SW] Precaching warning (non-fatal):', err);
      });
    })
  );
});

// Activate: purge stale caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for API, Cache-first (with background refresh) for shell & assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname === '/' && url.searchParams.get('shared') === 'true') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('prescription');
          if (file) {
            const cache = await caches.open('pillsync-shared-files');
            await cache.put('/shared-prescription', new Response(file, {
              headers: {
                'content-type': file.type,
                'x-filename': file.name
              }
            }));
          }
        } catch (err) {
          console.error('[PillSync SW] Share target handling error:', err);
        }
        return Response.redirect('/?shared=received', 303);
      })()
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request.clone()).catch(() => {
        return new Response(
          JSON.stringify({
            offline: true,
            error: 'You are currently offline. This request has been queued locally.',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html').then((response) => {
          return response || caches.match('/');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        const isFontHost =
          url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          (networkResponse.type !== 'basic' && !isFontHost)
        ) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        if (event.request.headers.get('accept')?.includes('image')) {
          return caches.match('/icons/icon-192.png');
        }
      });
    })
  );
});

// ---------------- INDEXEDDB HELPERS INSIDE SERVICE WORKER ----------------

function getLocalDateString(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getLocalHHMM(now = new Date()) {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function openPillSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('PillSync_DB_v2', 4);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function applyNotificationActionInDB(reminderId, userId, actionType, dateStr) {
  const db = await openPillSyncDB();
  const targetDate = dateStr || getLocalDateString();
  const now = new Date();

  await new Promise((resolve, reject) => {
    const tx = db.transaction(['reminders', 'doseLogs'], 'readwrite');
    const remStore = tx.objectStore('reminders');
    const logStore = tx.objectStore('doseLogs');

    const getReq = remStore.get(reminderId);
    getReq.onsuccess = () => {
      const rem = getReq.result;
      if (!rem || (userId && rem.userId !== userId)) return;

      const takenDates = Object.assign({}, rem.takenDates || {});
      const skippedDates = Object.assign({}, rem.skippedDates || {});
      const missedDates = Object.assign({}, rem.missedDates || {});

      if (actionType === 'taken') {
        rem.lastStatus = 'taken';
        rem.lastStatusDate = targetDate;
        takenDates[targetDate] = { takenAt: now.toISOString() };
        delete skippedDates[targetDate];
        delete missedDates[targetDate];
        rem.snoozedUntil = null;
        rem.snoozeCount = 0;
      } else if (actionType === 'skip') {
        rem.lastStatus = 'skipped';
        rem.lastStatusDate = targetDate;
        skippedDates[targetDate] = true;
        delete takenDates[targetDate];
        delete missedDates[targetDate];
        rem.snoozedUntil = null;
        rem.snoozeCount = 0;
      } else if (actionType === 'snooze') {
        rem.lastStatus = 'snoozed';
        rem.lastStatusDate = targetDate;
        rem.snoozedUntil = new Date(now.getTime() + 10 * 60000).toISOString();
        rem.snoozeCount = (rem.snoozeCount || 0) + 1;
      }

      rem.takenDates = takenDates;
      rem.skippedDates = skippedDates;
      rem.missedDates = missedDates;
      remStore.put(rem);

      if (actionType === 'taken' || actionType === 'skip') {
        logStore.put({
          id: `log_sw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          userId: rem.userId,
          reminderId: rem.id,
          prescriptionId: rem.prescriptionId,
          profileId: rem.profileId,
          medicineId: rem.medicineId,
          medicineName: rem.medicineName,
          action: actionType === 'taken' ? 'taken' : 'skipped',
          scheduledTime: rem.doseTime,
          actualTimestamp: now.toISOString(),
          dateStr: targetDate,
          source: rem.source || 'auto',
        });
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Notify any open clients so React refreshes immediately
  try {
    const channel = new BroadcastChannel('pillsync-reminders');
    channel.postMessage({ type: 'REMINDER_UPDATED', reminderId, action: actionType });
    channel.close();
  } catch {}

  const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clientsList) {
    client.postMessage({ type: 'REMINDER_UPDATED', reminderId, action: actionType });
  }
}

function showDoseNotification(payload) {
  const { title, body, tag, timestamp, reminderId, userId, dateStr, vibrate } = payload;
  const options = {
    body,
    tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    requireInteraction: true,
    vibrate: vibrate === false ? undefined : [250, 120, 250],
    actions: [
      { action: 'taken', title: 'Taken' },
      { action: 'snooze', title: 'Snooze 10 min' },
      { action: 'skip', title: 'Skip' },
    ],
    data: {
      reminderId,
      userId,
      dateStr: dateStr || getLocalDateString(),
    },
  };

  if (timestamp && typeof TimestampTrigger !== 'undefined') {
    options.showTrigger = new TimestampTrigger(timestamp);
  }

  return self.registration.showNotification(title || 'PillSync Reminder', options);
}

// Cancel existing scheduled PillSync notifications and schedule upcoming triggers if supported
async function rebuildScheduledTriggers(items) {
  try {
    if (self.registration.getNotifications) {
      const existing = await self.registration.getNotifications({ includeTriggered: true });
      for (const n of existing) {
        if (n.tag && n.tag.startsWith('pillsync-rem-')) {
          n.close();
        }
      }
    }
  } catch (err) {
    console.warn('[PillSync SW] Failed closing existing triggers:', err);
  }

  if (typeof TimestampTrigger === 'undefined' || !Array.isArray(items)) {
    return;
  }

  const now = Date.now();
  for (const item of items) {
    if (!item.timestamp || item.timestamp <= now) continue;
    try {
      await showDoseNotification(item);
    } catch (err) {
      console.warn('[PillSync SW] TimestampTrigger scheduling error:', err);
    }
  }
}

// Message listener for skipWaiting, immediate notifications, and scheduled rebuilds
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SCHEDULE_MEDICINE_NOTIFICATION') {
    event.waitUntil(showDoseNotification(event.data));
  }

  if (event.data && event.data.type === 'REBUILD_NOTIFICATION_SCHEDULE') {
    event.waitUntil(rebuildScheduledTriggers(event.data.items || []));
  }
});

// Periodic Background Sync (when supported by Chromium PWA)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'pillsync-reminder-check') {
    event.waitUntil(
      (async () => {
        try {
          const db = await openPillSyncDB();
          const now = new Date();
          const todayStr = getLocalDateString(now);
          const nowMins = now.getHours() * 60 + now.getMinutes();

          const allReminders = await new Promise((resolve) => {
            const tx = db.transaction('reminders', 'readonly');
            const req = tx.objectStore('reminders').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          });

          const allSettings = await new Promise((resolve) => {
            const tx = db.transaction('reminderSettings', 'readonly');
            const req = tx.objectStore('reminderSettings').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          });

          for (const rem of allReminders) {
            if (!rem.isActive || rem.scheduleKind === 'as_needed') continue;
            if (rem.takenDates && rem.takenDates[todayStr]) continue;
            if (rem.skippedDates && rem.skippedDates[todayStr]) continue;
            if (rem.excludedDates && rem.excludedDates[todayStr]) continue;
            if (rem.startDate && todayStr < rem.startDate) continue;
            if (rem.courseEndDate && !rem.ongoing && todayStr > rem.courseEndDate) continue;

            const userSettings = allSettings.find((s) => s.userId === rem.userId);
            if (userSettings && userSettings.masterEnabled === false) continue;
            if (userSettings && userSettings.pausedUntil && now.toISOString() < userSettings.pausedUntil) continue;
            if (rem.pausedUntil && now.toISOString() < rem.pausedUntil) continue;

            const [h, m] = (rem.doseTime || '08:00').split(':').map((n) => parseInt(n, 10) || 0);
            const doseMins = h * 60 + m - (rem.remindBeforeMinutes || 0);
            if (Math.abs(nowMins - doseMins) <= 15) {
              const hideNames = Boolean(userSettings && userSettings.hideMedicineNamesInNotifications);
              await showDoseNotification({
                title: hideNames ? 'PillSync Reminder' : `${rem.medicineName} (${rem.doseTime})`,
                body: hideNames ? 'Time for your medicine' : rem.doseSentence || `Time for ${rem.medicineName}`,
                tag: `pillsync-rem-${rem.id}-${todayStr}`,
                reminderId: rem.id,
                userId: rem.userId,
                dateStr: todayStr,
                vibrate: userSettings ? userSettings.vibrationEnabled : true,
              });
            }
          }
        } catch (err) {
          console.warn('[PillSync SW] periodicsync check error:', err);
        }
      })()
    );
  }
});

// Notification Click & Actions ("Taken", "Snooze 10 min", "Skip")
self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const data = event.notification.data || {};
  event.notification.close();

  if (action === 'taken' || action === 'snooze' || action === 'skip') {
    if (data.reminderId) {
      event.waitUntil(
        applyNotificationActionInDB(data.reminderId, data.userId, action, data.dateStr)
      );
    }
    return;
  }

  // Tapping notification body focuses or opens the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
