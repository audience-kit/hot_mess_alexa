'use strict';

var Alexa = require('alexa-sdk');
var APP_ID = 'amzn1.ask.skill.3e6cdd1f-d05a-450d-b878-79335010dafa';

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    //alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

var handlers = {
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
      let https = require('https');

      let alexaThis = this;

      https.get({
        host: 'api.hotmess.social',
        path: '/alexa',
        port : 443
      }, function(response) {
        // Continuously update stream with data
        var body = '';
        response.on('data', function(d) {
            body += d;
        });
        response.on('end', function() {
            alexaThis.emit(':tell', body);
        });
        response.on('error', function(error) {
          alexaThis.emit(':tell', error);
        })
      });
    }
  };

var languageStrings = {};
