var NOTIFICATION_ENDPOINT = "/example-fetch.json";
var URL_TO_DEFAULT_ICON = "/images/icon-192x192.png";

self.addEventListener('push', function(event) {
  console.log('Received a push message', event);
  // Since there is no payload data with the first version
  // of push messages, we'll grab some data from
  // an API and use it to populate a notification
  event.waitUntil(
    fetch(NOTIFICATION_ENDPOINT).then(function(response) {
      if (response.status !== 200) {
        // Either show a message to the user explaining the error
        // or enter a generic message and handle the
        // onnotificationclick event to direct the user to a web page
        console.log('Looks like there was a problem. Status Code: ' + response.status);
        throw new Error();
      }

      // Examine the text in the response
      return response.json().then(function(data) {
        if (data.error || !data.notification) {
          console.error('The API returned an error.', data.error);
          throw new Error();
        }

        var title = data.notification.title;
        var message = data.notification.message;
        var icon = data.notification.icon;
        var notificationTag = data.notification.tag;
        var notificationData = data.notification.data;

        return self.registration.showNotification(title, {
          body: message,
          icon: icon,
          tag: notificationTag,
          data: notificationData
        });
      });
    }).catch(function(err) {
      console.error('Unable to retrieve data', err);

      var title = 'An error occurred';
      var message = 'We were unable to get the information for this push message';
      var icon = URL_TO_DEFAULT_ICON;
      var notificationTag = 'simple-push-demo-notification-tag';
      return self.registration.showNotification(title, {
        body: message,
        icon: icon,
        tag: notificationTag
      });
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('On notification click: ', event);

  // check for data support
  if (Notification.prototype.hasOwnProperty('data')) {
    console.log('Using Data');
    var url = event.notification.data.url;
    event.waitUntil(clients.openWindow(url));
  } else {
    console.error('Could not get notification data. Fetching notification from server instead.');
    var request = fetch(NOTIFICATION_ENDPOINT)
      .then(function(res) {
        return res.json();
      });

    event.waitUntil(request)
      .then(function(res) {
        // At the moment you cannot open third party URL's, a simple trick
        // is to redirect to the desired URL from a URL on your domain
        var redirectUrl = '/?redirect=' +
          res.notification.data.url;
        return clients.openWindow(redirectUrl);
      });
  }
});