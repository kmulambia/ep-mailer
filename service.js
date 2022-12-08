require("dotenv").config();
var amqp = require('amqplib/callback_api');
var moment = require('moment');
const winston = require("winston");
const AWS = require("aws-sdk");
/*config */
AWS.config.update({
  accessKeyId: process.env.MAILER_ACCESS_KEY_ID,
  secretAccessKey: process.env.MAILER_SECRET_ACCESS_KEY,
  region: process.env.MAILER_REGION
});
const ses = new AWS.SES({ apiVersion: "2010-12-01" });
let sendEmail = (message) => {
  const params = {
    Source: process.env.MAILER_NAME,
    Template: message.template,
    Destination: {
      ToAddresses: [
        message.metadata.email
      ],
    },
    TemplateData: JSON.stringify(message.metadata),
  }
  response = ses.sendTemplatedEmail(params, (err, data) => {
    if (err) {
      logger.log({
        level: 'error',
        type: 'SENDING_EMAIL_FAILED',
        message: {
          error: true,
          service_name: process.env.MAILER_NAME,
          description: 'Error sending email',
          metadata: err,
          time: moment().format('DD/MM/YYYY hh:mm:ss')
        },
      });
    }
    else {
      logger.log({
        level: 'info',
        type: 'SENDING_EMAIL_OK',
        message: {
          error: true,
          service_name: process.env.MAILER_NAME,
          description: "Email sent succesfully",
          metadata: data,
          time: moment().format('DD/MM/YYYY hh:mm:ss')
        },
      });
    }
  });
};
/**
 * Replace this with the name of an existing template.
 */
/*loggers*/
const { createLogger, format, transports } = require("winston");
const { combine, timestamp, label, prettyPrint, colorize } = format;
const logger = createLogger({
  format: combine(timestamp(), prettyPrint(), colorize()),
  transports: [
    new transports.Console(),
    new winston.transports.File({
      filename: "error.log",
      level: "error",
    }),
    new winston.transports.File({
      filename: "service.log",
      level: "info",
    }),
    new winston.transports.File({
      filename: "debug.log",
      level: "debug",
    }),
  ],
});

/***/
amqp.connect(process.env.AMQ_URL, (error0, connection) => {
  if (error0) {
    logger.log({
      level: 'error',
      type: 'CONNECTION_FAILED',
      message: {
        error: true,
        service_name: process.env.MAILER_NAME,
        description: 'Error Connecting to RabbitMQ ',
        metadata: error0,
        time: moment().format('DD/MM/YYYY hh:mm:ss')
      },
    });
  }
  connection.createChannel((error1, channel) => {
    if (error1) {
      logger.log({
        level: 'error',
        type: 'CREATE_CHANNEL_FAILED',
        message: {
          error: true,
          service_name: process.env.MAILER_NAME,
          description: 'Error Creating RabbitMQ Channel ',
          metadata: error1,
          time: moment().format('DD/MM/YYYY hh:mm:ss')
        },
      });
    }
    var queue = process.env.MAILER_QUEUE;
    channel.assertQueue(queue, {
      durable: true
    });
    logger.log({
      level: 'info',
      type: 'CONNECTION_OK',
      message: {
        error: true,
        service_name: process.env.MAILER_NAME,
        description: "[*] Waiting for messages " + queue + " . To exit press CTRL+C",
        metadata: "",
        time: moment().format('DD/MM/YYYY hh:mm:ss')
      },
    });

    channel.consume(queue, (msg) => {
      logger.log({
        level: 'info',
        type: 'REQUEST_RECIEVED',
        message: {
          error: true,
          service_name: process.env.MAILER_NAME,
          description: "Email Received ",
          metadata: "",
          time: moment().format('DD/MM/YYYY hh:mm:ss')
        },
      });
      /*Send email*/
      sendEmail(JSON.parse(msg.content));
    }, {
      noAck: true
    });
  });
});
