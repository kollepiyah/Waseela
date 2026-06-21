/* GENERATED oleh scripts/build-tenant.mjs — JANGAN edit langsung.
   Firebase Cloud Messaging service worker — WEB PUSH (PWA/browser).
   Notifikasi saat tab tertutup/background. Wajib di root: /firebase-messaging-sw.js */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  "apiKey": "AIzaSyDEd5UKDcsy0QC1B1x_75L1VaTgasTzGTE",
  "authDomain": "waseela-id.firebaseapp.com",
  "projectId": "waseela-id",
  "storageBucket": "waseela-id.firebasestorage.app",
  "messagingSenderId": "31586326439",
  "appId": "1:31586326439:web:c8f394228777130242c882"
})

const messaging = firebase.messaging()

// Notifikasi saat app/tab di background
messaging.onBackgroundMessage((payload) => {
  const n = (payload && payload.notification) || {}
  const data = (payload && payload.data) || {}
  self.registration.showNotification(n.title || "Waseela", {
    body: n.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data
  })
})

// Klik notifikasi -> buka app ke link (router hash mode)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/'
  const url = '/#' + (String(link).startsWith('#') ? String(link).slice(1) : link)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          try { c.navigate(url) } catch (e) {}
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
