'use strict';

let humanize = require('humanize');
let XmlEscape = require('xml-escape');
let Alexa = require('alexa-sdk');
let unirest = require('unirest');
let APP_ID = 'amzn1.ask.skill.3e6cdd1f-d05a-450d-b878-79335010dafa';
let APP_KEY = 'SjZBQBD67/7OBAFp9/J3V59EMxsynuVuBlaiobdRotA=';
let API_BASE = 'https://next-api.hotmess.social';

let languageStrings = {
    'en-US': {
        'translation': {
            'SKILL_NAME': 'Hot Mess',
            'WELCOME_MESSAGE' : "Hot Mess is you're guide to local gay nightlife.  You can ask me whats going on and I'll find the next few events for you, or you can tell me you're going out and I'll let your friends know.  If you're friends have open pings, you can ask me where your friends are.",
            'WELCOME_REPROMPT': 'What can I look up?',
            'LOCATION_CONSENT': "In order to get events Hot Mess needs to know what city you live in.  Grant access to you're location in the Alexa app.",
            'HELP_MESSAGE': "Ask me what's going on and I'll look up the next few events near you. How can I help?",
            'HELP_REPROMPT': "How can I help?",
            'PING_CREATED': "Ok, I've created a ping for you",
            'SAFETY_PING_CREATED': "I'll let your circle know.  If this is an emergency please call 911 immediately.",
            'NO_FRIENDS': "I wasn't able to find any of your friends with an open ping.",
            'LINK_CONSENT': "In order to help you with your friends, you'll have to connect your Alexa to your Hot Mess account and in order for your friends to find you, you'll have to download Hot Mess from the App Store.  Open the Alexa app to finish signing in and connect with your friends."
        }
    }
};

exports.handler = function(event, context, callback) {
    let alexa = Alexa.handler(event, context, callback);
    alexa.appId = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

function toSentence(array) {
    return array.slice(0, array.length - 1).join(', ') + ", and " + array.slice(-1);
}

function handleEventRequest(locale, timespan) {
    let alexaThis = this;
    let deviceId = this.event.context.System.device.deviceId;
    let userId = this.event.context.System.user.userId;

    let uri = `${API_BASE}/alexa/events`;
    console.log(`Performing Hot Mess call at ${uri} (locale ${locale}, timespan ${timespan})`);
    unirest.get(uri)
        .query({ locale: locale, timespan: parseTime(timespan) })
        .headers({
            'Authorization': `Bearer ${APP_KEY}`,
            'Accept': 'application/javascript',
            'X-Device-Id': deviceId,
            'X-User-Id': userId
        })
        .end(function(response) {
            console.log(`Hot Mess /alexa/events ${response.code}: ${response.body}`);
            if (response.body['events'].length === 0) {
                alexaThis.emit(':tell', `There are no events in ${response.body['locale']}`);
            }
            else {
                let delta = response.body['timezone_delta'];
                let plural = response.body['events'].length === 1 ? 'event' : 'events';
                let ordinal = response.body['events'].length === 1 ? 'is' : 'are';

                let statements = response.body['events'].map(function(item) {
                    let start_at = (new Date(item['start_at']));
                    start_at.setSeconds(start_at.getSeconds() + delta);

                    return `at ${start_at.toLocaleTimeString()}, ${item['title']} at ${item['venue']}`;
                });

                let sentence = statements.length > 1 ? toSentence(statements) : statements[0];

                let output = `The next ${plural} in ${response.body['locale']} ${ordinal}: ${sentence}.`;
                alexaThis.emit(':tell', XmlEscape(output));
                console.log(`Performed :tell - ${output}`);
            }
    });
}

function withLocale(callback) {
    let alexaThis = this;

    console.log('Lambda Context', this.context);
    console.log('Event Context', this.event.context);

    if (this.event.context
        && this.event.context.System
        && this.event.context.System.device
        && this.event.context.System.device.deviceId
        && this.event.context.System.user
        && this.event.context.System.user.permissions
        && this.event.context.System.user.permissions.consentToken) {

        let consentToken = this.event.context.System.user.permissions.consentToken;
        let deviceId = this.event.context.System.device.deviceId;

        console.log(`Performing location GET for device ${deviceId}`);
        unirest.get(`https://api.amazonalexa.com/v1/devices/${deviceId}/settings/address/countryAndPostalCode`)
            .headers({ 'Authorization': `Bearer ${consentToken}`, 'Accept': 'application/json' })
            .end(function(response) {

                console.log(`Device (${deviceId}) location response ${response.code}: ${JSON.stringify(response.body)}`);
                if (response.code === 403) {
                    alexaThis.emit(':tellWithPermissionCard', alexaThis.t('LOCATION_CONSENT'), [ 'read::alexa:device:all:address:country_and_postal_code' ])
                }
                else if (response.code === 200) {
                    callback(response.body['postalCode']);
                }
            });
    }
    else {
        alexaThis.emit(':tellWithPermissionCard', alexaThis.t("LOCATION_CONSENT"), [ 'read::alexa:device:all:address:country_and_postal_code' ])
    }
}

function parseTime(timeValue) {
    return null;
}

function withAccount(callback) {
    let accessToken = this.event.session.user.accessToken;
    if (accessToken) {
        console.log('Has valid access token', accessToken);
        callback(accessToken);
    }
    else {
        this.emit(':tellWithLinkAccountCard', this.t('LINK_CONSENT'));
    }
}

let handlers = {
    //Use LaunchRequest, instead of NewSession if you want to use the one-shot model
    // Alexa, ask [my-skill-invocation-name] to (do something)...
    'LaunchRequest': function () {
        this.attributes['speechOutput'] = this.t("WELCOME_MESSAGE", this.t("SKILL_NAME"));
        // If the user either does not reply to the welcome message or says something that is not
        // understood, they will be prompted again with this text.
        this.attributes['repromptSpeech'] = this.t("WELCOME_REPROMPT");
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech'])
    },
    'GetEvents': function() {
        console.log('Performing Intent GetEvents');
        var citySlot = this.event.request.intent.slots.city;
        var timeSlot = this.event.request.intent.slots.at_time;

        let alexaThis = this;

        if (citySlot && citySlot.value) {
            if (timeSlot && timeSlot.value) {
                handleEventRequest.bind(alexaThis)(citySlot.value, timeSlot.value);
            }
            else {
                handleEventRequest.bind(alexaThis)(citySlot.value, null);
            }
        }
        else {
            withLocale.bind(alexaThis)(function(locale) {
                if (timeSlot && timeSlot.value) {
                    handleEventRequest.bind(alexaThis)(locale, timeSlot.value);
                }
                else {
                    handleEventRequest.bind(alexaThis)(locale, null);
                }
            });
        }
    },
    'GetFriends': function() {
        let alexa = this;

        let deviceId = this.event.context.System.device.deviceId;
        let userId = this.event.context.System.user.userId;

        withAccount.call(this, function(accesstoken) {
            console.log(`Performing Hot Mess call at /alexa/friends`);
            unirest.get(`${API_BASE}/alexa/friends`)
                .headers({
                    'Authorization': `JWT ${accesstoken}`,
                    'Accept': 'application/javascript',
                    'X-Device-Id': deviceId,
                    'X-User-Id': userId
                })
                .end(function(response) {
                    alexa.emit(':tell', alexa.t('NO_FRIENDS'));
                });
        });
    },
    'CreatePing': function() {
        let alexaThis = this;

        let deviceId = this.event.context.System.device.deviceId;
        let userId = this.event.context.System.user.userId;

        withAccount.bind(alexaThis)(function(accessToken) {


            withLocale.bind(alexaThis)(function(locale){
                console.log(`Performing Hot Mess call at /alexa/friends`);
                unirest.post(`${API_BASE}/alexa/ping`)
                    .send({ locale: locale })
                    .headers({
                        'Authorization': `JWT ${accessToken}`,
                        'Accept': 'application/javascript',
                        'X-Device-Id': deviceId,
                        'X-User-Id': userId
                    })
                    .end(function(response) {
                        alexaThis.emit(':tell', alexaThis.t('PING_CREATED'));
                    });
            });
        });
    },
    'CreateSafetyPing': function() {
        let alexaThis = this;

        let deviceId = this.event.context.System.device.deviceId;
        let userId = this.event.context.System.user.userId;

        withAccount.bind(alexaThis)(function(accessToken) {
            unirest.post(`${API_BASE}/alexa/ping`)
                .send({ safety: true })
                .headers({
                    'Authorization': `JWT ${accessToken}`,
                    'Accept': 'application/javascript',
                    'X-Device-Id': deviceId,
                    'X-User-Id': userId
                })
                .end(function(response) {
                    alexaThis.emit(':tell', alexaThis.t('SAFETY_PING_CREATED'));
                });
        });
    },
    'AMAZON.HelpIntent': function() {
        this.emit(':ask', this.t("HELP_MESSAGE"), this.t("HELP_REPROMPT"));
    },
    'AMAZON.StopIntent': function() {
        this.emit(':tell', '');
    },
    'AMAZON.CancelIntent': function() {
        this.emit(':tell', '');
    }
  };

