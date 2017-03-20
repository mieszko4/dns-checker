const Promise = require('bluebird');
const Slack = require('slack-node');

const lookup = Promise.promisify(require('dns-lookup'));

const config = require('./config');

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


Promise.map(config.domains, domain => lookup(domain))
.then(function(addresses) {
  const mapping = {};
  addresses.forEach((address, i) => {
    mapping[config.domains[i]] = address;
  });

  sendMessage(`*NEW IP ADDRESSES*: \`\`\`${JSON.stringify(mapping, null, 2)}\`\`\``);
}).catch((error) => {
  const message = (error && error.message) || 'Unknown';
  sendMessage(`*DNS LOOKUP ERROR*:\n${message}`);
});
