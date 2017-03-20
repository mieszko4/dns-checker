const fs = require('fs');
const Promise = require('bluebird');
const Slack = require('slack-node');
const request = Promise.promisify(require('request'), { multiArgs: true });
const ipRangeCheck = require("ip-range-check");

const lookup = Promise.promisify(require('dns-lookup')); // only IPv4! TODO

const config = require('./config');
const ipRanges = {};

slack = new Slack();
slack.setWebhook(config.slack.webhookUri);
const sendMessage = (text, channel) => {
  slack.webhook({
    channel: channel || config.slack.stdChannel,
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

const sendErrorMessage = (text) => {
  sendMessage(text, config.errorChannel);
}

const isIpValid = (ipRanges, ip, services, regions) => {
  return ipRanges.some(range =>
    services.indexOf(range.service) !== -1
    && regions.indexOf(range.region) !== -1
    && ipRangeCheck(ip, range.ip_prefix)
  );
};

const resolveDns = () => {
  console.log(new Date(), "Running dns-checker");
  request({ url: config.ipRangesUrl, json: true })
  .then((response) => {
    const ipRanges = response[1].prefixes;
    return ipRanges;
  })
  .then((ipRanges) => Promise.map(config.domains, domain => lookup(domain.name)
      .then((resolvedIp) => ({
        domain,
        resolvedIp,
        valid: isIpValid(ipRanges, resolvedIp, [domain.service], ['GLOBAL', domain.region])
      }))
    )
    .then(function(results) {
      // send error for invalid IPs
      const invalids = results.filter(result => !result.valid);
      if (invalids.length > 0) {
        const message = `*INVALID IPS*: \`\`\`${JSON.stringify(invalids, null, 2)}\`\`\``;
        sendErrorMessage(message);
      }
    }).catch((error) => {
      const message = (error && error.message) || 'Unknown';
      sendMessage(`*DNS LOOKUP ERROR*:\n${message}`);
    })
  ).catch((error) => {
    const message = (error && error.message) || 'Unknown';
    sendMessage(`*IP RANGES ERROR*:\n${message}`);
  }).finally(() => {
    console.log(new Date(), "Stopping dns-checker");
    setTimeout(resolveDns, config.interval);
  });
};

resolveDns();
