let assert = require("assert");

let index = require('../index');
let Alexa = require('alexa-sdk');

let APP_ID = 'amzn1.ask.skill.3e6cdd1f-d05a-450d-b878-79335010dafa';
let USER_ID = 'USER_1';

describe('Alexa', function() {
    describe('handler', function() {
        it('return a result from requests', function(done) {
            var event = {
                session: {
                    application: { applicationId: APP_ID },
                    user: { userId: USER_ID} },
                request: {
                    type: 'IntentRequest',
                    locale: 'en-US',
                    intent: {
                        name: 'GetEvents'
                    }
                },
                context: {
                    'System': {
                        user: {
                            permissions: { consentToken: 'SOMETOKEN' }
                        },
                        device: {
                            deviceId: 'DEVICE_ID'
                        },
                        application: {
                            applicationId: APP_ID
                        }
                    }
                }
            };

            var context = {
                succeed: function (result) {
                    done();
                }
            };


            index.handler(event, context);
        });
    });
});