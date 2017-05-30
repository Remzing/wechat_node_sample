'use strict'

var path = require('path')
var util = require('./libs/util')
var wechat_file = path.join(__dirname, './config/wechat.txt')
var config = {	//配置项
	wechat: {
		appID: 'wx593225632f502695',
		appSecret: '94ae197aee69b1a8cb3459d9ba3b2ce2',
		token: 'renyy_wechat_dev_sample',
		getAccessToken: function() {
			return util.readFileAsync(wechat_file)
		},
		saveAccessToken: function(data) {
			data = JSON.stringify(data)

			return util.writeFileAsync(wechat_file,data)
		},
	}
}

module.exports = config