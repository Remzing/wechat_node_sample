'use strict'

//加密模块
var sha1 = require('sha1')	
//通过这个raw-body模块可以把http中的requsest对象，拼装成为一个buffer的xml数据
var getRawBody = require('raw-body')	
var Wechat = require('./wechat')
var util = require('./util')

module.exports = function(opts, handler) {
	var wechat = new Wechat(opts)

	//生成器函数 、中间件;处理事件，处理推送信息。返回推送信息
	return function*(next) { 
		var that = this;
		// console.log(this.query)
		var token = opts.token;
		//获取签名
		var signature = this.query.signature;
		var nonce = this.query.nonce;
		//获取时间戳
		var timestamp = this.query.timestamp;
		var echostr = this.query.echostr;

		//将token、timestamp、nonce三个参数进行字典序排序
		var str = [token, timestamp, nonce].sort().join('')
		//将三个参数字符串拼接成一个字符串进行sha1加密
		var sha = sha1(str)

		if (this.method === 'GET') {
			//开发者获得加密后的字符串可与signature对比，标识该请求来源于微信
			if (sha === signature) {
				this.body = echostr + '';
			}
			else {
				this.body = 'wrong';
			}
		}
		else if (this.method === 'POST') {
			if (sha !== signature) {
				this.body = 'wrong';
				return false;
			}
			
			var data = yield getRawBody(this.req, {
				length: this.length,
				limit: '1mb',
				encoding: this.charset
			})
			// console.log(data.toString());

			var content = yield util.parseXMLAsync(data);

			// console.log(content)

			var message = util.formatMessage(content.xml)

			console.log(message)

			this.weixin = message;

			yield handler.call(this, next)

			wechat.reply.call(this)

		}
	}
}
