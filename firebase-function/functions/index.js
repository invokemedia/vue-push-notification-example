/**
 * Pings all the users in our database and triggers a notification fetch
 */
'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const request = require('request-promise');

process.on('uncaughtException', (err) => {
  console.log('uncaughtException', err.stack);
});

process.on('unhandledRejection', (reason, p) => {
  console.log('unhandledRejection', p, reason);
});

// graceful shutdown
process.on('SIGINT', function() {
  console.log('Starting shutdown');
  process.exit(0);
});

function handleRequest(req, res) {
  const googleEndpoints = {
    registration_ids: []
  };

  const firefoxUsers = [];
  return new Promise(function(resolve, reject) {
      admin.database().ref('/subscriptions')
        .once('value', (snapshot) => {
          resolve(snapshot.val());
        });
    })
    .then((subscribers) => {
      for (let key in subscribers) {
        const s = subscribers[key];
        // google and firefox requests are handled differently
        if (s.endpoint.indexOf('googleapis') !== -1) {
          const formattedEndpoint = s.endpoint.replace('https://android.googleapis.com/gcm/send/', '');
          googleEndpoints.registration_ids.push(formattedEndpoint);
        } else if (s.endpoint.indexOf('mozilla') !== -1) {
          firefoxUsers.push(notifyFirefoxUsers(s.endpoint));
        }
      }

      // do all the firefox requests and then return the google ids for their requests
      return Promise.all(firefoxUsers)
        .then((values) => {
          console.log('Firefox requests', values);
        })
        .then(() => {
          console.log('Google endpoints', googleEndpoints);
          return notifyGoogleUsers(googleEndpoints);
        })
        .then((response) => {
          // the google response
          console.log(response.body);
        })
        .then(() => {
          if (res) {
            res.json({
              status: 'OK'
            });
          } else {
            process.exit(0);
          }
        })
        .catch((err) => {
          console.log(err);
          process.exit(0);
        });
    });
}

// handle the firefox requests
function notifyFirefoxUsers(userEndpoint) {
  const options = {
    method: 'POST',
    uri: userEndpoint,
    headers: {
      ttl: '60'
    }
  };

  return request(options);
}

// send a request for the google users
function notifyGoogleUsers(endpointIds) {
  const google = require('./google-push-key.json');
  const options = {
    uri: 'https://android.googleapis.com/gcm/send',
    method: 'POST',
    json: true,
    headers: {
      authorization: `key=${google.key}`
    },
    resolveWithFullResponse: true,
    body: endpointIds
  };

  return request(options);
}

// lets you run this as if it was a local function
if (process.env.NODE_ENV == 'local') {
  const firebaseFile = require("../firebase-adminsdk.json");
  admin.initializeApp({
    credential: admin.credential.cert(firebaseFile),
    databaseURL: `https://${firebaseFile.project_id}.firebaseio.com`
  });
  handleRequest();
} else {
  admin.initializeApp(functions.config().firebase);
  // Reads the content of the node that triggered the function and sends it to the registered Webhook
  // URL.
  exports.notify = functions.https.onRequest(handleRequest);
}