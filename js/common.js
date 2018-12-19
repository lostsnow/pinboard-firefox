// userInfo: name, pwd, isChecked
var _userInfo = null, _tags = [], keyPrefix = 'pbuinfo',
checkedkey = keyPrefix + 'c',
namekey = keyPrefix + 'n',
authTokenKey = keyPrefix + '_auth_token',

// config in the settings for not checking page pin state
nopingKey = keyPrefix + 'np',
// config in the settings for always check the private checkbox
allprivateKey = keyPrefix + 'allprivate',
// config in the settings for disabling page action
nopageaction = keyPrefix + 'nopageaction',
// config in the settings for wrapping text with <blockquote>
noblockquoteKey = keyPrefix + 'noblockquote',

mainPath = 'https://api.pinboard.in/v1/',

yesIcon = {
    "18": "/img/icon-blue-18.png",
    "32": "/img/icon-blue-32.png",
    "36": "/img/icon-blue-36.png",
    "64": "/img/icon-blue-64.png"
},
noIcon = {
    "18": "/img/icon-gray-18.png",
    "32": "/img/icon-gray-32.png",
    "36": "/img/icon-gray-36.png",
    "64": "/img/icon-gray-64.png"
},
savingIcon = {
    "18": "/img/icon-gray-saving-18.png",
    "32": "/img/icon-gray-saving-32.png",
    "36": "/img/icon-gray-saving-36.png",
    "64": "/img/icon-gray-saving-64.png"
};

var REQ_TIME_OUT = 125 * 1000, maxDescLen = 500;


var isBlockquote = function () {
    var noBlockquote = localStorage[noblockquoteKey];
    return typeof noBlockquote == 'undefined' || noBlockquote === 'false';
};
