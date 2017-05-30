'use strict'

var Koa = require('koa')	//node框架 比express更简易
var wechat = require('./wechat/g')
var config = require('./config')
var weixin = require('./weixin')
var app = new Koa()

app.use(wechat(config.wechat, weixin.reply))

app.listen(8080)
console.log('server running port: 8080')