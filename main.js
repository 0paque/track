// Start Constant

var SettingContext = React.createContext();
var MessageContext = React.createContext();
var RouteContext = React.createContext();
var Storage = window.localStorage;
var CURRENT_SETTING_VERSION = 1;
var SETTING_KEY = 'setting';
var MESSAGES_KEY = 'messages';

// End Constant

// Start Storage

function Version1Loader(setting) {
  return {
    name: setting.name,
    senderBotToken: setting.senderBotToken,
    receiverBotToken: setting.receiverBotToken,
    senderChannelID: setting.senderChannelID,
    receiverChannelID: setting.receiverChannelID,
  };
}

var SettingVersionLoaders = {
  [1]: Version1Loader,
};

function loadFromURL() {
  params = parseQueryString();
  if (
    params['n'] &&
    params['st'] &&
    params['rt'] &&
    params['sch'] &&
    params['rch']
  ) {
    return {
      name: params['n'],
      senderBotToken: params['st'],
      receiverBotToken: params['rt'],
      senderChannelID: params['sch'],
      receiverChannelID: params['rch'],
    };
  } else {
    return undefined;
  }
}

function loadSetting() {
  var settingFromQS = loadFromURL();
  if (settingFromQS) {
    preserveSetting(settingFromQS);
    return settingFromQS;
  }

  var setting = Storage.getItem(SETTING_KEY);
  if (!setting) {
    return null;
  }
  try {
    setting = JSON.parse(setting);
  } catch {
    console.log('Invalid saved setting');
    return null;
  }

  return SettingVersionLoaders[setting.version](setting);
}

function preserveSetting(setting) {
  var payload = JSON.stringify(
    Object.assign({version: CURRENT_SETTING_VERSION}, setting),
  );
  Storage.setItem(SETTING_KEY, payload);
}

function loadMessages() {
  var messages = Storage.getItem(MESSAGES_KEY);
  if (!messages) {
    return [];
  }

  try {
    messages = JSON.parse(messages);
  } catch {
    console.log('Invalid saved messages');
    return [];
  }

  return messages;
}

function preserveMessages(messages) {
  Storage.setItem(MESSAGES_KEY, JSON.stringify(messages));
}

// End Storage

// Start Utils

function Validator(key, errorCondition, errorMessage) {
  return {
    key: key,
    errorCondition: errorCondition,
    errorMessage: errorMessage,
  };
}

function validate(validators) {
  return validators.reduce(function(errors, validator) {
    if (validator.errorCondition) {
      var updatedErrors = Object.assign({}, errors);
      updatedErrors[validator.key] = validator.errorMessage;
      return updatedErrors;
    }
    return errors;
  }, {});
}

function classnames() {
  var output = '';

  for (var i = 0; i < arguments.length; i++) {
    var arg = arguments[i];
    var classnames;

    if (arg instanceof Object) {
      var keys = Object.keys(arg);
      classnames = keys.reduce(function(acc, key) {
        if (arg[key]) {
          return acc ? acc + ' ' + key : key;
        } else {
          return acc;
        }
      }, '');
    } else {
      classnames = arg;
    }
    output = output ? output + ' ' + classnames : classnames;
  }
  return output;
}

function modify(source, modification) {
  return Object.assign(Object.assign({}, source), modification);
}

function endpoint(token, method) {
  return 'https://api.telegram.org/bot' + token + '/' + method;
}

function sendMessage(token, channel, name, message) {
  var url = endpoint(token, 'sendMessage');

  if (channel[0] !== '@' && channel[0] !== '-') {
    channel = '@' + channel;
  }

  message = name + ':\n' + message;

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: channel,
      text: message,
    }),
  });
}

function fetchMessages(token, offset) {
  var url = endpoint(token, 'getUpdates');

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      offset: offset,
      timeout: 60,
      allowed_updates: ['channel_post'],
    }),
  })
    .then(function(resp) {
      return resp.json();
    })
    .then(function(resp) {
      if (resp.result) {
        return resp.result;
      }
      return [];
    })
    .catch(function() {
      return [];
    });
}

function createState(defaultValue) {
  state = React.useState(defaultValue);
  var state = {
    value: state[0],
    set: state[1],
    update: function(modification) {
      this.set(modify(this.value, modification));
    },
  };

  state.update.bind(state);
  return state;
}

function parseQueryString() {
  var query = window.location.search.substring(1);
  var vars = query.split('&');
  var params = {};
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    key = decodeURIComponent(pair[0]);
    value = decodeURIComponent(pair[1]);
    params[key] = value;
  }

  return params;
}

function composeQueryString(params) {
  return Object.keys(params)
    .map(function(key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    })
    .join('&');
}

// End Utils

// Start Components

function SettingContextProvider(props) {
  var state = createState({
    name: '',
    senderBotToken: '',
    receiverBotToken: '',
    senderChannelID: '',
    receiverChannelID: '',
  });

  var _validate = function() {
    return validate([
      Validator('name', state.value.name.trim() === '', 'Name is empty'),
      Validator(
        'senderBotToken',
        state.value.senderBotToken.trim() === '',
        'Sender Bot Token is empty',
      ),
      Validator(
        'receiverBotToken',
        state.value.receiverBotToken.trim() === '',
        'Receiver Bot Token is empty',
      ),
      Validator(
        'senderChannelID',
        state.value.senderChannelID.trim() === '',
        'Sender Channel ID is empty',
      ),
      Validator(
        'receiverChannelID',
        state.value.receiverChannelID.trim() === '',
        'Receiver Channel ID is empty',
      ),
    ]);
  };

  var toURL = function(setting) {
    var url =
      window.location.href +
      composeQueryString({
        n: setting.name,
        st: setting.senderBotToken,
        rt: setting.receiverBotToken,
        sch: setting.senderChannelID,
        rch: setting.receiverChannelID,
      });
    return url;
  };

  var update = function(key, value) {
    state.update({[key]: value.trim()});
  };

  var save = function() {
    var errors = _validate();

    if (Object.keys(errors).length > 0) {
      return errors;
    }
    preserveSetting(state.value);
    return undefined;
  };

  var isComplete = function() {
    return Object.keys(state.value).reduce(function(acc, key) {
      return acc && !!state.value[key];
    }, true);
  };

  var load = function() {
    var setting = loadSetting();
    if (setting) {
      state.update(setting);
      return true;
    }
    return false;
  };

  return React.createElement(
    SettingContext.Provider,
    {
      value: Object.assign(
        {
          update: update,
          save: save,
          load: load,
          isComplete: isComplete,
        },
        state.value,
      ),
    },
    props.children,
  );
}

function MessageContextProvider(props) {
  var messages = createState([]);
  var state = createState({
    offset: 0,
    version: 0,
    token: undefined,
  });
  var isLoaded = createState(false);
  var setting = React.useContext(SettingContext);

  var startFetch = function(botToken) {
    state.update({version: 1, token: botToken});
  };

  var load = function() {
    messages.set(loadMessages());
    isLoaded.set(true);
  };

  var processMessage = function(message) {
    var sender = message.channel_post.text.split('\n')[0];
    sender = sender.substring(0, sender.length - 1);
    if (sender === setting.name) {
      return modify(message.channel_post, {position: 'right'});
    } else {
      return modify(message.channel_post, {position: 'left'});
    }
  };

  React.useEffect(
    function() {
      if (state.value.version > 0 && isLoaded.value) {
        fetchMessages(state.value.token, state.value.offset).then(function(
          newMessages,
        ) {
          if (newMessages.length > 0) {
            messages.set(
              messages.value.concat(
                newMessages
                  .filter(function(x) {
                    return !!x.channel_post.text;
                  })
                  .map(processMessage),
              ),
            );
            state.update({
              offset: newMessages[newMessages.length - 1].update_id + 1,
              version: state.value.version + 1,
            });
          } else {
            state.update({
              version: state.value.version + 1,
            });
          }
        });
      }
    },
    [state.value, isLoaded.value],
  );

  React.useEffect(
    function() {
      if (state.value.offset > 0) {
        preserveMessages(messages.value);
      }
    },
    [messages.value, state.value],
  );

  return React.createElement(
    MessageContext.Provider,
    {
      value: {
        messages: messages.value,
        startFetch: startFetch,
        load: load,
      },
    },
    props.children,
  );
}

function RouteContextProvider(props) {
  var route = createState('chat');

  return React.createElement(
    RouteContext.Provider,
    {
      value: {
        route: route.value,
        navigate: route.set,
      },
    },
    props.children,
  );
}

function Root() {
  return React.createElement(
    'div',
    {className: 'app'},
    React.createElement(
      RouteContextProvider,
      {},
      React.createElement(
        SettingContextProvider,
        {},
        React.createElement(
          MessageContextProvider,
          {},
          React.createElement(App, {}, null),
        ),
      ),
    ),
  );
}

function Loading() {
  return React.createElement(
    'div',
    {className: 'loading'},
    React.createElement('div', {className: 'lds-dual-ring'}, null),
  );
}

function Header(props) {
  var route = React.useContext(RouteContext);
  return React.createElement(
    'header',
    {},
    React.createElement('h1', {}, route.route),
    React.createElement(
      'div',
      {className: 'leftButtons'},
      props.leftButtons ? props.leftButtons : null,
    ),
    React.createElement(
      'div',
      {className: 'rightButtons'},
      props.rightButtons ? props.rightButtons : null,
    ),
  );
}

var AppRoutes = {
  chat: ChatScreen,
  setting: SettingScreen,
};

function App() {
  var isReady = createState(false);
  var route = React.useContext(RouteContext);

  var setting = React.useContext(SettingContext);
  React.useEffect(function() {
    if (!setting.load()) {
      route.navigate('setting');
    }
    setTimeout(function() {
      isReady.set(true);
    }, 500);
  }, []);

  return isReady.value
    ? React.createElement(
        'div',
        {className: 'expand'},
        React.createElement(AppRoutes[route.route], {}, null),
      )
    : React.createElement(Loading, {}, null);
}

function LabelledField(props) {
  return React.createElement(
    'div',
    {
      className: classnames('labelledField', {
        errored: props.errorMessage !== undefined,
      }),
    },
    React.createElement('label', {}, props.label),
    React.createElement(
      'input',
      {
        value: props.value,
        placeholder: props.placeholder,
        onChange: props.onChange,
      },
      null,
    ),
    React.createElement(
      'div',
      {className: 'errorMessage'},
      props.errorMessage || '',
    ),
  );
}

function SettingScreen(props) {
  var errors = createState({});
  var setting = React.useContext(SettingContext);
  var route = React.useContext(RouteContext);

  var onSave = function() {
    console.log('onSave');
    var validationErrors = setting.save();
    errors.set(validationErrors || {});
    if (Object.keys(validationErrors || {}).length === 0) {
      route.navigate('chat');
    }
  };

  var onFieldChange = function(key, value) {
    errors.update({[key]: undefined});
    setting.update(key, value);
  };

  return React.createElement(
    'div',
    {className: 'setting'},
    React.createElement(
      Header,
      {
        leftButtons: setting.isComplete()
          ? React.createElement(
              'span',
              {
                className: 'glyphicon glyphicon-chevron-left',
                onClick: function() {
                  route.navigate('chat');
                },
              },
              null,
            )
          : null,
      },
      null,
    ),
    React.createElement(
      'div',
      {},
      React.createElement(
        LabelledField,
        {
          label: 'Name',
          placeholder: 'Please enter your name',
          value: setting.name,
          errorMessage: errors.value['name'],
          onChange: function(e) {
            onFieldChange('name', e.target.value);
          },
        },
        null,
      ),
      React.createElement(
        LabelledField,
        {
          label: 'Sender Bot Token',
          placeholder: 'Please enter sender telegram bot token',
          value: setting.senderBotToken,
          errorMessage: errors.value['senderBotToken'],
          onChange: function(e) {
            onFieldChange('senderBotToken', e.target.value);
          },
        },
        null,
      ),
      React.createElement(
        LabelledField,
        {
          label: 'Receiver Bot Token',
          placeholder: 'Please enter receiver telegram bot token',
          value: setting.receiverBotToken,
          errorMessage: errors.value['receiverBotToken'],
          onChange: function(e) {
            onFieldChange('receiverBotToken', e.target.value);
          },
        },
        null,
      ),
      React.createElement(
        LabelledField,
        {
          label: 'Sender Channel ID',
          placeholder: 'Please enter sender channel ID',
          value: setting.senderChannelID,
          errorMessage: errors.value['senderChannelID'],
          onChange: function(e) {
            onFieldChange('senderChannelID', e.target.value);
          },
        },
        null,
      ),
      React.createElement(
        LabelledField,
        {
          label: 'Receiver Channel ID',
          placeholder: 'Please enter receiver channel ID',
          value: setting.receiverChannelID,
          errorMessage: errors.value['receiverChannelID'],
          onChange: function(e) {
            onFieldChange('receiverChannelID', e.target.value);
          },
        },
        null,
      ),
      React.createElement(
        'div',
        {
          className: 'saveButton',
          onClick: onSave,
        },
        'Save',
      ),
    ),
  );
}

function MessageBubble(props) {
  var setting = React.useContext(SettingContext);
  var lines = props.message.text.split('\n');
  var content = lines.slice(1).map(function(item, key) {
    return React.createElement(
      'span',
      {key: key},
      item,
      React.createElement('br', {}, null),
    );
  });

  var timestamp = new Date(props.message.date * 1000);

  return React.createElement(
    'div',
    {
      className: classnames('messageBubble', {
        leftBubble: props.message.position === 'left',
        rightBubble: props.message.position === 'right',
      }),
    },
    React.createElement('div', {className: 'content'}, content),
    React.createElement(
      'div',
      {className: 'timestamp'},
      timestamp.toLocaleString(),
    ),
  );
}

function ChatScreen(props) {
  var message = createState('');
  var textArea = React.useRef();
  var setting = React.useContext(SettingContext);
  var route = React.useContext(RouteContext);
  var messages = React.useContext(MessageContext);

  var bubbleContainer = React.useRef();

  var onMessageChange = function(e) {
    message.set(e.target.value);
    if (textArea.current) {
      autosize(textArea.current);
    }
  };

  var resetMessageBoxHeight = function() {
    if (textArea.current) {
      textArea.current.style.height = '42px';
    }
  };

  var onSend = function() {
    if (message.value.trim() === '') {
      return;
    }

    message.set('');
    resetMessageBoxHeight();

    var promises = [
      sendMessage(
        setting.senderBotToken,
        setting.senderChannelID,
        setting.name,
        message.value,
      ),
    ];

    if (setting.receiverChannelID !== setting.senderChannelID) {
      promises.push(
        sendMessage(
          setting.senderBotToken,
          setting.senderChannelID,
          setting.name,
          message.value,
        ),
      );
    }

    Promise.all(promises).catch(function() {
      alert('Failed to send: ' + message.value);
    });
  };

  var renderMessageBubbles = function() {
    return messages.messages.map(function(message) {
      return React.createElement(
        MessageBubble,
        {key: message.message_id, message: message},
        null,
      );
    });
  };

  React.useEffect(function() {
    messages.load();
    messages.startFetch(setting.receiverBotToken);
  }, []);

  React.useEffect(
    function() {
      if (bubbleContainer.current) {
        bubbleContainer.current.scrollTop =
          bubbleContainer.current.scrollHeight;
      }
    },
    [messages.messages],
  );

  return React.createElement(
    'div',
    {className: 'expand'},
    React.createElement(
      Header,
      {
        rightButtons: React.createElement(
          'span',
          {
            className: 'glyphicon glyphicon-cog',
            onClick: function() {
              route.navigate('setting');
            },
          },
          null,
        ),
      },
      null,
    ),
    React.createElement(
      'div',
      {className: 'chat'},
      React.createElement(
        'div',
        {className: 'messages', ref: bubbleContainer},
        renderMessageBubbles(),
      ),
      React.createElement(
        'div',
        {className: 'messageInput'},
        React.createElement(
          'textarea',
          {
            ref: textArea,
            value: message.value,
            onChange: onMessageChange,
          },
          null,
        ),
        React.createElement(
          'div',
          {
            className: classnames('sendButton', {
              disabled: message.value.trim() === '',
            }),
            onClick: onSend,
          },
          React.createElement(
            'span',
            {className: 'glyphicon glyphicon-circle-arrow-up'},
            null,
          ),
        ),
      ),
    ),
  );
}

// End Components

window.addEventListener('load', function() {
  ReactDOM.render(
    React.createElement(Root, null, null),
    document.getElementById('root'),
  );
});
