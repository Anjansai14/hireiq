/**
 * Central Database Models Registry
 * Direct mapping between business logic and the database layer
 */
const Course = require('./Course');
const Campaign = require('./Campaign');
const Source = require('./Source');
const Connector = require('./Connector');
const RateCard = require('./RateCard');
const Governance = require('./Governance');

module.exports = {
  Course,
  Campaign,
  Source,
  Connector,
  RateCard,
  Governance
};
