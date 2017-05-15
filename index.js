'use strict';

let humanize = require('humanize');
let Alexa = require('alexa-sdk');
let unirest = require('unirest');
let APP_ID = 'amzn1.ask.skill.3e6cdd1f-d05a-450d-b878-79335010dafa';

let languageStrings = {
    'en-US': {
        'translation': {
            'SKILL_NAME': 'Hot Mess',
            'WELCOME_MESSAGE' : "Hot Mess is you're guide to local gay nightlife.  You can ask me whats going on and I'll find the next few events for you.",
            'WELCOME_REPROMPT': 'What can I look up?',
            'LOCATION_CONSENT': "In order to get events Hot Mess needs to know what city you live in.  Grant access to you're location in the Alexa app.",
            'HELP_MESSAGE': "Ask me what's going on and I'll look up the next few events near you."
        }
    }
};

exports.handler = function(event, context, callback) {
    let alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

function toSentence(array) {
    return array.slice(0, array.length - 1).join(', ') + ", and " + array.slice(-1);
}

function handleEventRequest(zip, timespan) {
    let alexaThis = this;
    let deviceId = this.event.context.System.device.deviceId;
    let userId = this.event.context.System.user.userId;

    unirest.get(`https://api.hotmess.social/alexa?zip=${zip}`)
        .headers({ 'Accept': 'application/javascript',
            'X-Device-Id': deviceId,
            'X-User-Id': userId})
        .end(function(response) {
            if (response.body['events'].length === 0) {
                alexaThis.emit(':tell', `There are no events in ${response.body['locale']}`);
            }
            else {
                let plural = response.body['events'].length === 1 ? 'event' : 'events';
                let ordinal = response.body['events'].length === 1 ? 'is' : 'are';

                let statements = response.body['events'].map(function(item) {
                    let start_at = new Date(item['start_at']);

                    return `at ${start_at.toLocaleTimeString()}, ${item['title']} at ${item['venue']}`;
                });

                let output = `The next ${plural} in ${response.body['locale']} ${ordinal}: ${toSentence(statements)}.`;
                alexaThis.emit(':tell', output);
            }
    });
}

function withZipCode(callback) {
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

        unirest.get(`https://api.amazonalexa.com/v1/devices/${deviceId}/settings/address/countryAndPostalCode`)
            .headers({ 'Authorization': `Bearer ${consentToken}`, 'Accept': 'application/json' })
            .end(function(response) {

                if (response.code === 403) {
                    alexaThis.emit(':tellWithPermissionCard', alexaThis.t('LOCATION_CONSENT'), [ 'read::alexa:device:all:address:country_and_postal_code' ])
                }
                else if (response.code === 200) {
                    callback.call(alexaThis, response.body['postalCode']);
                }
            });
    }
    else {
        alexaThis.emit(':tellWithPermissionCard', alexaThis.t("LOCATION_CONSENT"), [ 'read::alexa:device:all:address:country_and_postal_code' ])
    }
}

function parseTime() {
    return null;
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
        withZipCode.call(this, function(zip) {
            handleEventRequest.call(this, zip, null);
        })
    },
    'GetEventsWithTime': function() {
        withZipCode.call(this, function(zip) {
            handleEventRequest.call(this, zip, parseTime());
        })
    },
    'GetHelp': function() {
        this.emit(':tell', this.t("HELP_MESSAGE"));
    },
    'GetFriends': function() {

    }
  };

