const fs = require('fs');
const Promise = require('bluebird');
const Slack = require('slack-node');

const lookup = Promise.promisify(require('dns-lookup'));

const config = require('./config');
const storage = {}; // in memory storage

slack = new Slack();
slack.setWebhook(config.slack.webhookUri);
const sendMessage = (text) => {
  slack.webhook({
    channel: config.slack.channel,
    username: config.slack.username,
    text
  }, function(err, response) {
    if (err) {
      console.log(new Date(), 'Could not connect to slack', err.message);
    } else if (response.status === 'fail') {
      console.log(new Date(), 'Could not send to slack', response);
    }
  });
}

const resolveDns = () => {
  Promise.map(config.domains, domain => lookup(domain))
  .then(function(addresses) {
    const mapping = {};
    addresses.forEach((address, i) => {
      const domain = config.domains[i];
      mapping[domain] = address;
    });

    // check if any new
    const newMapping = {};
    console.log('ChECKING');
    Object.keys(mapping).forEach(domain => {
      const ip = mapping[domain];

      const storedIps = storage[domain] || [];

      if (storedIps.indexOf(ip) === -1) {
        storedIps.push(ip);
        newMapping[domain] = ip;
        storage[domain] = storedIps;
      }
    });

    if (Object.keys(newMapping).length > 0) {
      sendMessage(`*NEW IP ADDRESSES*: \`\`\`${JSON.stringify(mapping, null, 2)}\`\`\``);
    }
  }).catch((error) => {
    const message = (error && error.message) || 'Unknown';
    sendMessage(`*DNS LOOKUP ERROR*:\n${message}`);
  }).finally(() => {
    setTimeout(resolveDns, 5000);
  });
};

resolveDns();
